import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import {
  transactions,
  organizations,
  plans,
  projects,
  users,
  snags,
  rfis,
  project_members,
  files,
  manuals,
  Sequelize,
} from "../models/index.ts";
import { Op } from "sequelize";
import { getIO } from "../socket.ts";
import { generateInvoice } from "../services/invoiceService.ts";
import { getSubscriptionAccessState } from "../utils/subscriptionAccess.ts";

/**
 * Razorpay controller for handling subscriptions
 */
const GST_RATE = 0.18;
const RAZORPAY_MAX_ORDER_AMOUNT_INR = 500000;

const formatInvoicePrefix = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `APX-${dd}-${mm}-`;
};

const generateInvoiceNumber = async (date: Date = new Date()) => {
  const prefix = formatInvoicePrefix(date);
  const latest = await transactions.findOne({
    where: { invoice_number: { [Op.like]: `${prefix}%` } },
    attributes: ["invoice_number"],
    order: [["invoice_number", "DESC"]],
  });

  const latestInvoice = (latest as any)?.invoice_number as string | undefined;
  const latestSeq = latestInvoice
    ? Number(latestInvoice.split("-").pop() || "0")
    : 0;
  const nextSeq = Number.isFinite(latestSeq) ? latestSeq + 1 : 1;
  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
};

export const createOrder = async (req: Request, res: Response) => {
  try {
    const { organization_id, user_id } = (req as any).user;
    const { amount, currency, plan_name, plan_cycle, seats } = req.body;
    const requestedAmount = Number(amount);
    const seatsCount = Math.max(1, parseInt(seats || 1, 10));

    if (seatsCount > 100) {
      return res.status(400).json({
        message: "For custom pricing on more than 100 seats, please contact support@apexis.in",
      });
    }

    if (!currency || !plan_cycle) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (!["monthly", "annual"].includes(String(plan_cycle))) {
      return res.status(400).json({ message: "Invalid plan cycle" });
    }

    const org = await organizations.findByPk(organization_id);
    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    const currentSeats = org.seats_purchased || 1;
    const unitPrice = plan_cycle === "annual" ? 99 : 159;

    const now = new Date();
    const endDate = org.plan_end_date ? new Date(org.plan_end_date) : null;
    const isPlanActive = endDate && endDate.getTime() > now.getTime();

    let normalizedAmount = 0;
    let isUpgrade = false;
    let addedSeats = 0;
    let remainingDays = 0;

    if (seatsCount < currentSeats && isPlanActive) {
      // Organization-wide seat check: Ensure total contributor memberships across all projects do not exceed target seat count
      const orgProjects = await projects.findAll({
        where: { organization_id },
        attributes: ["id", "name"],
      });

      const projectIds = orgProjects.map((p: any) => p.id);
      if (projectIds.length > 0) {
        const totalContributors = await project_members.count({
          where: {
            project_id: { [Op.in]: projectIds },
            role: "contributor",
          },
        });

        if (totalContributors > seatsCount) {
          return res.status(400).json({
            message: `Cannot decrease to ${seatsCount} seats because your organization currently has ${totalContributors} total active contributors across projects. Please remove contributors first.`,
          });
        }
      }

      // Update organization seats directly (No payment required for prepaid seat reduction)
      await organizations.update(
        { seats_purchased: seatsCount },
        { where: { id: organization_id } }
      );

      // Create transaction audit log for seat reduction
      await transactions.create({
        organization_id,
        user_id: user_id,
        subscription_tier: "Seat Reduction",
        subscription_cycle: plan_cycle,
        seats_purchased: seatsCount,
        price_per_seat: unitPrice,
        payment_amount: 0,
        payment_order_id: `downgrade_org_${organization_id}_${Date.now()}`,
        payment_status: "success",
      });

      // Real-time socket notification
      try {
        const orgUsers = await users.findAll({
          where: { organization_id },
          attributes: ["id"],
        });
        const io = getIO();
        for (const u of orgUsers as any[]) {
          io.to(`user-${String(u.id)}`).emit("subscription-updated", {
            organization_id,
            plan_name: org.plan_name,
            plan_cycle,
            subscription_end_date: org.plan_end_date,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (socketError) {
        console.error("Failed to emit subscription-updated socket event:", socketError);
      }

      return res.status(200).json({
        is_downgrade: true,
        is_upgrade: false,
        seats: seatsCount,
        message: `Seats count successfully updated to ${seatsCount}.`,
      });
    }

    if (seatsCount > currentSeats) {
      isUpgrade = true;
      addedSeats = seatsCount - currentSeats;

      if (isPlanActive && endDate) {
        const diffMs = endDate.getTime() - now.getTime();
        remainingDays = Math.max(1, Math.ceil(diffMs / (1000 * 3600 * 24)));
      } else {
        remainingDays = plan_cycle === "annual" ? 365 : 30;
      }

      const fullCycleCost = plan_cycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
      const dailyRatePerSeat = plan_cycle === "annual" ? (99 * 12) / 365 : 159 / 30;
      const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);

      normalizedAmount = Math.max(1, Math.min(fullCycleCost, proratedCost));
    } else {
      normalizedAmount = plan_cycle === "annual" ? seatsCount * 99 * 12 : seatsCount * 159;
    }

    if (normalizedAmount > RAZORPAY_MAX_ORDER_AMOUNT_INR) {
      return res.status(400).json({
        message: `Amount exceeds Razorpay maximum allowed per order (INR ${RAZORPAY_MAX_ORDER_AMOUNT_INR.toLocaleString("en-IN")}).`,
      });
    }

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const options = {
      amount: Math.round(normalizedAmount * 100), // convert to paise
      currency,
      receipt: `receipt_org_${organization_id}_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    // Create initial transaction record
    await transactions.create({
      organization_id,
      user_id: user_id,
      subscription_tier: isUpgrade ? "Seat Upgrade" : (plan_name || "Seat Subscription"),
      subscription_cycle: plan_cycle,
      seats_purchased: seatsCount,
      price_per_seat: unitPrice,
      payment_amount: normalizedAmount,
      payment_order_id: order.id,
      payment_status: "pending",
    });

    res.status(201).json({
      order,
      seats: seatsCount,
      added_seats: addedSeats,
      is_upgrade: isUpgrade,
      remaining_days: remainingDays,
      unit_price: unitPrice,
      amount: normalizedAmount,
    });
  } catch (error: any) {
    console.error("Error creating order:", error);
    const statusCode = error?.statusCode || error?.status || 500;
    const message =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Internal server error";
    return res
      .status(statusCode >= 400 && statusCode < 600 ? statusCode : 500)
      .json({
        message,
        details: error?.error || undefined,
      });
  }
};


export const verifyPayment = async (req: Request, res: Response) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan_name,
      plan_cycle,
    } = req.body;
    const { organization_id } = (req as any).user;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment details" });
    }

    // Verify signature
    const shasum = crypto.createHmac(
      "sha256",
      process.env.RAZORPAY_KEY_SECRET!,
    );
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest("hex");

    if (digest !== razorpay_signature) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update transaction
    const transaction = await transactions.findOne({
      where: { payment_order_id: razorpay_order_id },
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction record not found" });
    }

    const invoiceNumber =
      (transaction as any).invoice_number || (await generateInvoiceNumber(new Date()));

    await transaction.update({
      payment_id: razorpay_payment_id,
      payment_signature: razorpay_signature,
      payment_status: "success",
      invoice_number: invoiceNumber,
    });

    const org = await organizations.findByPk(organization_id);

    // Update organization subscription
    // Support case-insensitive plan matching
    const selectedPlan = await plans.findOne({
      where: {
        name: plan_name,
      },
    });

    if (!selectedPlan) {
      console.error(`Plan not found: ${plan_name}`);
      return res.status(404).json({ message: "Plan not found in database" });
    }

    const isUpgrade = (transaction as any).subscription_tier === "Seat Upgrade";
    const now = new Date();
    const existingEndDate = org?.plan_end_date ? new Date(org.plan_end_date) : null;
    const isPlanActive = existingEndDate && existingEndDate.getTime() > now.getTime();

    let planStartDate = new Date();
    let planEndDate = new Date();

    if (isUpgrade && isPlanActive && existingEndDate) {
      // Preserve existing dates on prorated seat upgrade
      planStartDate = org?.plan_start_date ? new Date(org.plan_start_date) : new Date();
      planEndDate = existingEndDate;
    } else {
      if (plan_cycle === "annual") {
        planEndDate.setFullYear(planEndDate.getFullYear() + 1);
      } else {
        planEndDate.setMonth(planEndDate.getMonth() + 1);
      }
    }

    const seatsPurchased = (transaction as any).seats_purchased || 1;
    const pricePerSeat = (transaction as any).price_per_seat || (plan_cycle === "annual" ? 99 : 159);

    await organizations.update(
      {
        plan_id: selectedPlan ? selectedPlan.id : 1,
        plan_name: plan_name || "Seat Subscription",
        plan_price: Math.round(Number((transaction as any).payment_amount || 0)),
        seats_purchased: Number(seatsPurchased),
        price_per_seat: Number(pricePerSeat),
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
      },
      { where: { id: organization_id } },
    );

    // Real-time sync: notify all org users to refresh plan/usage immediately.
    try {
      const orgUsers = await users.findAll({
        where: { organization_id },
        attributes: ["id"],
      });
      const io = getIO();
      for (const u of orgUsers as any[]) {
        io.to(`user-${String(u.id)}`).emit("subscription-updated", {
          organization_id,
          plan_name: selectedPlan.name,
          plan_cycle,
          subscription_end_date: planEndDate,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      console.error(
        "Failed to emit subscription-updated socket event:",
        socketError,
      );
    }

    res.status(200).json({
      message: "Payment verified and subscription updated",
      transaction,
      subscription_end_date: planEndDate,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getTransactions = async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const history = await transactions.findAll({
      where: { organization_id },
      order: [["created_at", "DESC"]],
    });
    res.status(200).json(history);
  } catch (error: any) {
    console.error("Error fetching transactions:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getUsage = async (req: Request, res: Response) => {
  try {
    let { organization_id } = (req as any).user;

    // Fallback if organization_id is null/missing (Global Role view)
    if (!organization_id) {
      const user = await users.findByPk((req as any).user.user_id, {
        attributes: ["organization_id"],
      });
      organization_id = user?.organization_id;
    }

    if (!organization_id) {
      return res.status(404).json({ error: "Organization not found for user" });
    }

    const org = await organizations.findByPk(organization_id, {
      include: [{ model: plans }],
    });

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const plan = org.plan;

    // 1. Calculate Project Usage
    const projectCount = await projects.count({
      where: { organization_id: org.id },
    });

    // 2. Calculate Member Usage
    // Comprehensive counting: include users associated via project_members OR organization_id
    const orgProjects = await projects.findAll({
      where: { organization_id: org.id },
      attributes: ["id", "name"],
      raw: true,
    });

    const projectIds = orgProjects.map((p: any) => p.id);

    const getMemberCount = async (role: "contributor" | "client") => {
      if (projectIds.length === 0) return 0;
      return await project_members.count({
        where: {
          project_id: { [Op.in]: projectIds },
          role: role,
        },
      });
    };

    const contributorCount = await getMemberCount("contributor");
    const clientCount = await getMemberCount("client");

    // 3. Calculate Snag & RFI Usage (across all projects)

    const snagCount = await snags.count({
      where: { project_id: { [Op.in]: projectIds } },
    });
    const rfiCount = await rfis.count({
      where: { project_id: { [Op.in]: projectIds } },
    });

    // 4. Proactive Alert Logic (Expiry & Per-Project Storage)
    const now = new Date();
    const expiryDate = new Date(org.plan_end_date);
    const diffDays = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
    );
    const access = getSubscriptionAccessState(org.plan_end_date, now);

    // Organization-wide contributor seats limit (purchased seats directly apply to total org contributors)
    const effectiveProjectCount = Math.max(1, projectCount);
    const perProjectStorageLimitMb = org.storage_limit_mb || org.plan?.storage_limit_mb || 5000;
    const seatsPurchased = org.seats_purchased || 1;

    const totalSeatsLimit = seatsPurchased;
    const totalStorageLimitMb = perProjectStorageLimitMb * effectiveProjectCount;

    const storageUsagePercent = Math.min(100, (org.storage_used_mb / totalStorageLimitMb) * 100);

    // Check per-project storage usage against per-project limit
    let exceededProjects: string[] = [];
    if (projectIds.length > 0) {
      const projectStorageCounts: any[] = await files.findAll({
        where: { project_id: { [Op.in]: projectIds } },
        attributes: ["project_id", [Sequelize.fn("SUM", Sequelize.col("file_size_mb")), "sum_size"]],
        group: ["project_id"],
        raw: true,
      });

      const manualStorageCounts: any[] = await manuals.findAll({
        where: { project_id: { [Op.in]: projectIds } },
        attributes: ["project_id", [Sequelize.fn("SUM", Sequelize.col("file_size_mb")), "sum_size"]],
        group: ["project_id"],
        raw: true,
      });

      const projectStorageMap: Record<number, number> = {};
      projectStorageCounts.forEach((item: any) => {
        projectStorageMap[Number(item.project_id)] = Number(item.sum_size || 0);
      });
      manualStorageCounts.forEach((item: any) => {
        const current = projectStorageMap[Number(item.project_id)] || 0;
        projectStorageMap[Number(item.project_id)] = current + Number(item.sum_size || 0);
      });

      let userProjectIds: Set<number> | null = null;
      const userRole = (req as any).user?.role;
      const userId = (req as any).user?.user_id;
      const isAllowedRoleForStorageAlert = ["admin", "superadmin", "contributor"].includes(userRole);

      if (userRole !== "admin" && userRole !== "superadmin") {
        const memberships = await project_members.findAll({
          where: { user_id: userId },
          attributes: ["project_id"],
          raw: true,
        });
        userProjectIds = new Set(memberships.map((m: any) => Number(m.project_id)));
      }

      if (isAllowedRoleForStorageAlert) {
        exceededProjects = orgProjects
          .filter((p: any) => {
            if (userProjectIds && !userProjectIds.has(Number(p.id))) {
              return false;
            }
            return (projectStorageMap[p.id] || 0) >= perProjectStorageLimitMb;
          })
          .map((p: any) => p.name);
      }
    }

    let alert = null;
    const userRole = (req as any).user?.role;
    const isAllowedRoleForStorageAlert = ["admin", "superadmin"].includes(userRole);

    if (diffDays <= 10 || exceededProjects.length > 0 || (isAllowedRoleForStorageAlert && storageUsagePercent >= 90)) {
      if (access.isLocked) {
        alert = {
          type: "expiry",
          severity: "error",
          message:
            "Your grace period has ended. Please renew now to restore full access.",
        };
      } else if (diffDays <= 0) {
        alert = {
          type: "expiry",
          severity: "warning",
          message:
            `Your plan has expired. Grace period: ${access.graceDaysRemaining} day(s) remaining.`,
        };
      } else if (exceededProjects.length > 0 && isAllowedRoleForStorageAlert) {
        const projectNamesStr = exceededProjects.join(", ");
        const projectText = exceededProjects.length === 1 ? `the ${projectNamesStr} project` : `projects: ${projectNamesStr}`;
        const isAdmin = userRole === "admin" || userRole === "superadmin";
        const actionText = isAdmin
          ? "Contact support@apexis.in for more storage."
          : "Please contact your project Admin to increase the storage.";

        alert = {
          type: "storage",
          severity: "error",
          message: `Storage limit reached in ${projectText}. ${actionText}`,
        };
      } else if (
        diffDays <= 10 &&
        (storageUsagePercent < 90 || diffDays < 100 - storageUsagePercent)
      ) {
        alert = {
          type: "expiry",
          severity: "warning",
          message: `Your plan expires in ${diffDays} days. Upgrade now to avoid service interruption.`,
        };
      } else if (isAllowedRoleForStorageAlert && storageUsagePercent >= 90) {
        alert = {
          type: "storage",
          severity: "warning",
          message: `You have used ${Math.round(storageUsagePercent)}% of your total storage limit. Contact support@apexis.in for more storage.`,
        };
      }
    }

    const effectiveLimits = plan ? {
      ...plan.toJSON(),
      contributor_limit: totalSeatsLimit,
      storage_limit_mb: totalStorageLimitMb,
      per_project_storage_limit_mb: perProjectStorageLimitMb,
    } : {
      contributor_limit: totalSeatsLimit,
      storage_limit_mb: totalStorageLimitMb,
      per_project_storage_limit_mb: perProjectStorageLimitMb,
      project_limit: 999999,
      client_limit: 999,
      max_snags: 9999,
      max_rfis: 9999,
      can_export_reports: true,
      can_share_media: true,
      can_export_handover: true,
    };

    res.status(200).json({
      plan: {
        name: org.plan_name || "Starter",
        seats_purchased: seatsPurchased,
        price_per_seat: org.price_per_seat || 159,
        startDate: org.plan_start_date,
        endDate: org.plan_end_date,
        daysRemaining: Math.max(0, diffDays),
        limits: effectiveLimits,
        access: {
          isExpired: access.isExpired,
          isInGracePeriod: access.isInGracePeriod,
          isLocked: access.isLocked,
          graceEndDate: access.graceEndDate,
          graceDaysRemaining: access.graceDaysRemaining,
        },
      },
      usage: {
        projects: projectCount,
        seats_purchased: seatsPurchased,
        seats_limit_total: totalSeatsLimit,
        seats_used: contributorCount,
        seats_remaining: Math.max(0, totalSeatsLimit - contributorCount),
        contributors: contributorCount,
        clients: clientCount,
        snags: snagCount,
        rfis: rfiCount,
        storage_mb: org.storage_used_mb,
        storage_limit_per_project_mb: perProjectStorageLimitMb,
        storage_limit_mb: totalStorageLimitMb,
        storage_percent: Math.round(storageUsagePercent),
      },
      alert,
    });
  } catch (error) {
    console.error("Error fetching usage:", error);
    res.status(500).json({ error: "Internal server error fetching usage" });
  }
};

export const getPlans = async (req: Request, res: Response) => {
  try {
    const activePlans = await plans.findAll({
      where: { is_active: true },
      order: [["price", "ASC"]],
    });
    res.status(200).json(activePlans);
  } catch (error) {
    console.error("Error fetching plans:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};


export const getInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { organization_id } = (req as any).user;

    const transaction = await transactions.findOne({
      where: { id, organization_id },
    });
    if (!transaction) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    const buffer = await generateInvoice(Number(id));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${transaction.invoice_number || id}.pdf`);
    res.send(buffer);
  } catch (error) {
    console.error("Error fetching invoice:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

export const validateSeatChange = async (req: Request, res: Response) => {
  try {
    let { organization_id } = (req as any).user;
    if (!organization_id) {
      const user = await users.findByPk((req as any).user.user_id, {
        attributes: ["organization_id"],
      });
      organization_id = user?.organization_id;
    }

    if (!organization_id) {
      return res.status(404).json({ error: "Organization not found" });
    }

    const targetSeats = Math.max(1, parseInt(req.body.targetSeats || 1, 10));

    const orgProjects = await projects.findAll({
      where: { organization_id },
      attributes: ["id", "name", "description"],
      order: [["name", "ASC"]],
    });

    const projectDetails = await Promise.all(
      orgProjects.map(async (project: any) => {
        const membersList = await project_members.findAll({
          where: { project_id: project.id },
          include: [
            {
              model: users,
              attributes: ["id", "name", "email", "phone_number", "profile_pic", "role"],
            },
          ],
          order: [["createdAt", "DESC"]],
        });

        const formattedMembers = membersList.map((pm: any) => ({
          project_member_id: pm.id,
          user_id: pm.user_id,
          role: pm.role,
          name: pm.user?.name || "Unknown User",
          email: pm.user?.email || "",
          phone_number: pm.user?.phone_number || "",
          profile_pic: pm.user?.profile_pic || null,
        }));

        const contributorCount = formattedMembers.filter((m: any) => m.role === "contributor").length;
        const clientCount = formattedMembers.filter((m: any) => m.role === "client").length;

        return {
          id: project.id,
          name: project.name,
          description: project.description,
          contributorCount,
          teamMemberCount: contributorCount,
          clientCount,
          members: formattedMembers,
        };
      })
    );

    const totalContributors = projectDetails.reduce((sum, p) => sum + p.contributorCount, 0);
    const isExceeded = totalContributors > targetSeats;

    return res.status(200).json({
      valid: !isExceeded,
      targetSeats,
      totalContributors,
      exceeded: isExceeded,
      exceededBy: Math.max(0, totalContributors - targetSeats),
      projects: projectDetails,
    });
  } catch (error: any) {
    console.error("Error validating seat change:", error);
    return res.status(500).json({ error: "Internal server error validating seat change" });
  }
};
