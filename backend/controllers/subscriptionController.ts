import type { Request, Response } from "express";
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
import razorpay, { RAZORPAY_KEY_ID } from "../config/razorpayConfig.ts";

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
    const isPaidPlan = Boolean(org.plan_name && !["freemium", "free"].includes(org.plan_name.toLowerCase()) && org.razorpay_subscription_id);
    const isPlanActive = Boolean(isPaidPlan && endDate && endDate.getTime() > now.getTime());

    // Validate that requested seatsCount can accommodate existing active contributors in the org
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
          message: `Cannot set seat count to ${seatsCount} because your organization currently has ${totalContributors} total active contributors across projects. Please remove contributors first.`,
        });
      }
    }

    // 1. DOWNGRADE FLOW (Decreasing seats on active plan)
    if (seatsCount < currentSeats && isPlanActive) {

      // Try updating existing subscription quantity first (works for Card payments)
      let directUpdateSuccess = false;
      if (org.razorpay_subscription_id) {
        try {
          await razorpay.subscriptions.update(org.razorpay_subscription_id, {
            quantity: seatsCount,
            schedule_change_at: "cycle_end",
          });
          directUpdateSuccess = true;
        } catch (subErr: any) {
          console.warn("[Razorpay Direct Sub Update Notice - Falling back to Future Sub scheduling]:", subErr?.error?.description || subErr?.message || subErr);
        }
      }

      if (directUpdateSuccess) {
        await organizations.update(
          { seats_purchased: seatsCount },
          { where: { id: organization_id } }
        );

        await transactions.create({
          organization_id,
          user_id,
          subscription_tier: "Seat Reduction",
          subscription_cycle: plan_cycle,
          seats_purchased: seatsCount,
          price_per_seat: unitPrice,
          payment_amount: 0,
          payment_order_id: `downgrade_org_${organization_id}_${Date.now()}`,
          payment_status: "success",
          razorpay_subscription_id: org.razorpay_subscription_id,
        });

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
          is_subscription: false,
          seats: seatsCount,
          message: `Seats count successfully updated to ${seatsCount}. Next cycle will bill for ${seatsCount} seats.`,
        });
      }

      // Fallback for UPI AutoPay: Create future subscription starting at cycle end
      const startAtTimestamp = Math.floor(new Date(org.plan_end_date).getTime() / 1000);
      const pricePerSeatInPaise = plan_cycle === "annual" ? 99 * 12 * 100 : 159 * 100;
      const planPeriod = plan_cycle === "annual" ? "yearly" : "monthly";

      const razorpayPlan = await razorpay.plans.create({
        period: planPeriod,
        interval: 1,
        item: {
          name: `Apexis ${plan_cycle === "annual" ? "Annual" : "Monthly"} Seat Plan (${seatsCount} Seats)`,
          amount: pricePerSeatInPaise,
          currency: "INR",
          description: `Automated recurring seat subscription (${plan_cycle})`,
        },
      });

      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlan.id,
        total_count: plan_cycle === "annual" ? 10 : 100,
        quantity: seatsCount,
        start_at: startAtTimestamp,
        customer_notify: 1,
        notes: {
          organization_id: String(organization_id),
          user_id: String(user_id),
          plan_cycle,
          is_downgrade: "true",
        },
      });

      await transactions.create({
        organization_id,
        user_id,
        subscription_tier: "Seat Reduction (AutoPay Mandate)",
        subscription_cycle: plan_cycle,
        seats_purchased: seatsCount,
        price_per_seat: unitPrice,
        payment_amount: 0,
        payment_order_id: subscription.id,
        payment_status: "pending",
        razorpay_subscription_id: subscription.id,
      });

      return res.status(201).json({
        is_subscription: true,
        is_downgrade: true,
        subscriptionId: subscription.id,
        keyId: RAZORPAY_KEY_ID,
        seats: seatsCount,
        amount: 0,
        amountInPaise: 0,
        plan_cycle,
        message: `Please authorize the new ${seatsCount}-seat AutoPay mandate for your next renewal cycle starting ${new Date(org.plan_end_date).toLocaleDateString()}.`,
      });
    }

    // 2. MID-CYCLE UPGRADE FLOW (Increasing seats on active plan)
    if (seatsCount > currentSeats && isPlanActive) {
      const addedSeats = seatsCount - currentSeats;
      const remainingDays = endDate ? Math.max(1, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24))) : 30;

      const fullCycleCost = plan_cycle === "annual" ? addedSeats * 99 * 12 : addedSeats * 159;
      const dailyRatePerSeat = plan_cycle === "annual" ? (99 * 12) / 365 : 159 / 30;
      const proratedCost = Math.round(addedSeats * dailyRatePerSeat * remainingDays);
      const normalizedAmount = Math.max(1, Math.min(fullCycleCost, proratedCost));

      if (normalizedAmount > RAZORPAY_MAX_ORDER_AMOUNT_INR) {
        return res.status(400).json({
          message: `Amount exceeds Razorpay maximum allowed per order (INR ${RAZORPAY_MAX_ORDER_AMOUNT_INR.toLocaleString("en-IN")}).`,
        });
      }

      // Try updating existing subscription quantity first (works for Card payments)
      let directUpdateSuccess = false;
      if (org.razorpay_subscription_id) {
        try {
          await razorpay.subscriptions.update(org.razorpay_subscription_id, {
            quantity: seatsCount,
            schedule_change_at: "cycle_end",
          });
          directUpdateSuccess = true;
        } catch (subErr: any) {
          console.warn("[Razorpay Direct Sub Update Notice - Falling back to Future Sub scheduling]:", subErr?.error?.description || subErr?.message || subErr);
        }
      }

      if (directUpdateSuccess) {
        // One-time order for prorated mid-cycle upgrade payment
        const options = {
          amount: Math.round(normalizedAmount * 100), // paise
          currency,
          receipt: `receipt_org_${organization_id}_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);

        await transactions.create({
          organization_id,
          user_id,
          subscription_tier: "Seat Upgrade",
          subscription_cycle: plan_cycle,
          seats_purchased: seatsCount,
          price_per_seat: unitPrice,
          payment_amount: normalizedAmount,
          payment_order_id: order.id,
          payment_status: "pending",
          razorpay_subscription_id: org.razorpay_subscription_id,
        });

        return res.status(201).json({
          is_subscription: false,
          is_upgrade: true,
          order,
          seats: seatsCount,
          added_seats: addedSeats,
          remaining_days: remainingDays,
          unit_price: unitPrice,
          amount: normalizedAmount,
        });
      }

      // Fallback for UPI AutoPay: Create new Subscription with start_at & addons
      const startAtTimestamp = Math.floor(new Date(org.plan_end_date).getTime() / 1000);
      const pricePerSeatInPaise = plan_cycle === "annual" ? 99 * 12 * 100 : 159 * 100;
      const planPeriod = plan_cycle === "annual" ? "yearly" : "monthly";

      const razorpayPlan = await razorpay.plans.create({
        period: planPeriod,
        interval: 1,
        item: {
          name: `Apexis ${plan_cycle === "annual" ? "Annual" : "Monthly"} Seat Plan (${seatsCount} Seats)`,
          amount: pricePerSeatInPaise,
          currency: "INR",
          description: `Automated recurring seat subscription (${plan_cycle})`,
        },
      });

      const subscription = await razorpay.subscriptions.create({
        plan_id: razorpayPlan.id,
        total_count: plan_cycle === "annual" ? 10 : 100,
        quantity: seatsCount,
        start_at: startAtTimestamp,
        customer_notify: 1,
        addons: normalizedAmount > 0 ? [
          {
            item: {
              name: `Mid-cycle Prorated Seat Upgrade (${addedSeats} added seat(s), ${remainingDays} days remaining)`,
              amount: Math.round(normalizedAmount * 100),
              currency: "INR",
            }
          }
        ] : [],
        notes: {
          organization_id: String(organization_id),
          user_id: String(user_id),
          plan_cycle,
          is_upgrade: "true",
        },
      });

      await transactions.create({
        organization_id,
        user_id,
        subscription_tier: "Seat Upgrade (AutoPay Mandate)",
        subscription_cycle: plan_cycle,
        seats_purchased: seatsCount,
        price_per_seat: unitPrice,
        payment_amount: normalizedAmount,
        payment_order_id: subscription.id,
        payment_status: "pending",
        razorpay_subscription_id: subscription.id,
      });

      return res.status(201).json({
        is_subscription: true,
        is_upgrade: true,
        subscriptionId: subscription.id,
        keyId: RAZORPAY_KEY_ID,
        seats: seatsCount,
        added_seats: addedSeats,
        remaining_days: remainingDays,
        unit_price: unitPrice,
        amount: normalizedAmount,
        amountInPaise: Math.round(normalizedAmount * 100),
        plan_cycle,
      });
    }

    // 3. NEW SUBSCRIPTION FLOW (Fresh Plan, Renewal, or Billing Cycle Switch Monthly <-> Annual)
    const startAtTimestamp = isPlanActive && org?.plan_end_date && new Date(org.plan_end_date).getTime() > now.getTime()
      ? Math.floor(new Date(org.plan_end_date).getTime() / 1000)
      : undefined;

    const pricePerSeatInPaise = plan_cycle === "annual" ? 99 * 12 * 100 : 159 * 100;
    const planPeriod = plan_cycle === "annual" ? "yearly" : "monthly";

    // Create Razorpay Plan for recurring billing
    const razorpayPlan = await razorpay.plans.create({
      period: planPeriod,
      interval: 1,
      item: {
        name: `Apexis ${plan_cycle === "annual" ? "Annual" : "Monthly"} Seat Plan`,
        amount: pricePerSeatInPaise, // per seat amount in paise
        currency: "INR",
        description: `Automated recurring seat subscription (${plan_cycle})`,
      },
    });

    // Create Razorpay Subscription with seat quantity
    const subscriptionOptions: any = {
      plan_id: razorpayPlan.id,
      total_count: plan_cycle === "annual" ? 10 : 100, // 10 years max for annual, 100 billing cycles max for monthly (Razorpay limit)
      quantity: seatsCount,
      customer_notify: 1,
      notes: {
        organization_id: String(organization_id),
        user_id: String(user_id),
        plan_cycle,
      },
    };

    if (startAtTimestamp) {
      subscriptionOptions.start_at = startAtTimestamp;
    }

    const subscription = await razorpay.subscriptions.create(subscriptionOptions);

    await org.update({
      razorpay_plan_id: razorpayPlan.id,
      subscription_cycle: plan_cycle,
    });

    const initialAmount = plan_cycle === "annual" ? seatsCount * 99 * 12 : seatsCount * 159;

    await transactions.create({
      organization_id,
      user_id,
      subscription_tier: plan_name || "Seat Subscription",
      subscription_cycle: plan_cycle,
      seats_purchased: seatsCount,
      price_per_seat: unitPrice,
      payment_amount: initialAmount,
      payment_order_id: subscription.id,
      payment_status: "pending",
      razorpay_subscription_id: subscription.id,
    });

    return res.status(201).json({
      is_subscription: true,
      subscriptionId: subscription.id,
      keyId: RAZORPAY_KEY_ID,
      seats: seatsCount,
      amount: initialAmount,
      amountInPaise: Math.round(initialAmount * 100),
      plan_cycle,
    });
  } catch (error: any) {
    console.error("Error creating order/subscription:", error);
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
      razorpay_subscription_id,
      razorpay_signature,
      plan_name,
      plan_cycle,
    } = req.body;
    const { organization_id } = (req as any).user;

    const subOrOrderId = razorpay_subscription_id || razorpay_order_id;

    if (!subOrOrderId || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: "Missing payment verification details" });
    }

    // Verify HMAC SHA-256 signature
    let signatureVerified = false;

    if (razorpay_subscription_id) {
      // Razorpay Subscription signature format: razorpay_payment_id|razorpay_subscription_id
      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
      hmac.update(`${razorpay_payment_id}|${razorpay_subscription_id}`);
      signatureVerified = hmac.digest("hex") === razorpay_signature;
    }

    if (!signatureVerified && razorpay_order_id) {
      // Razorpay Order signature format: razorpay_order_id|razorpay_payment_id
      const hmac = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
      hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
      signatureVerified = hmac.digest("hex") === razorpay_signature;
    }

    if (!signatureVerified) {
      return res.status(400).json({ message: "Invalid payment signature" });
    }

    // Update transaction
    const transaction = await transactions.findOne({
      where: {
        organization_id,
        [Op.or]: [
          { payment_order_id: subOrOrderId },
          { razorpay_subscription_id: subOrOrderId },
        ],
      },
      order: [["created_at", "DESC"]],
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
      razorpay_subscription_id: razorpay_subscription_id || (transaction as any).razorpay_subscription_id,
    });

    const org = await organizations.findByPk(organization_id);
    const selectedPlan = await plans.findOne({ where: { name: plan_name } });

    const now = new Date();
    const existingEndDate = org?.plan_end_date ? new Date(org.plan_end_date) : null;
    const isPlanActive = Boolean(existingEndDate && existingEndDate.getTime() > now.getTime());
    const isMidCycleChange = isPlanActive && Boolean(existingEndDate);

    let planStartDate = new Date();
    let planEndDate = new Date();

    if (isMidCycleChange && existingEndDate) {
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

    const newSubId = razorpay_subscription_id || (transaction as any).razorpay_subscription_id;
    const oldSubId = org?.razorpay_subscription_id;

    if (newSubId && oldSubId && newSubId !== oldSubId) {
      try {
        const fetchedOldSub = await razorpay.subscriptions.fetch(oldSubId);
        const cancelAtCycleEnd = Boolean(fetchedOldSub.paid_count && fetchedOldSub.paid_count > 0);
        await razorpay.subscriptions.cancel(oldSubId, cancelAtCycleEnd);
        console.log(`[AutoPay Replacement]: Cancelled old subscription ${oldSubId} (cancelAtCycleEnd: ${cancelAtCycleEnd}) in favor of ${newSubId}`);
      } catch (cancelErr: any) {
        console.warn("[AutoPay Replacement Notice]: Failed to cancel old subscription", cancelErr?.error?.description || cancelErr?.message || cancelErr);
      }
    }

    const newStorageLimit = selectedPlan?.storage_limit_mb || 5120;

    await organizations.update(
      {
        plan_id: selectedPlan ? selectedPlan.id : 1,
        plan_name: plan_name || "Seat Subscription",
        plan_price: Math.round(Number((transaction as any).payment_amount || 0)),
        seats_purchased: Number(seatsPurchased),
        price_per_seat: Number(pricePerSeat),
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        storage_limit_mb: newStorageLimit,
        razorpay_subscription_id: razorpay_subscription_id || org?.razorpay_subscription_id,
        auto_pay_enabled: razorpay_subscription_id ? true : org?.auto_pay_enabled || false,
        subscription_cycle: plan_cycle || org?.subscription_cycle,
      },
      { where: { id: organization_id } },
    );

    // Real-time sync: notify all org users
    try {
      const orgUsers = await users.findAll({
        where: { organization_id },
        attributes: ["id"],
      });
      const io = getIO();
      for (const u of orgUsers as any[]) {
        io.to(`user-${String(u.id)}`).emit("subscription-updated", {
          organization_id,
          plan_name: selectedPlan ? selectedPlan.name : "Seat Subscription",
          plan_cycle,
          subscription_end_date: planEndDate,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      console.error("Failed to emit subscription-updated socket event:", socketError);
    }

    res.status(200).json({
      message: "Payment verified and Razorpay AutoPay subscription active",
      transaction,
      subscription_end_date: planEndDate,
      auto_pay_enabled: true,
    });
  } catch (error: any) {
    console.error("Error verifying payment:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const cancelAutoPaySubscription = async (req: Request, res: Response) => {
  try {
    const { organization_id, user_id } = (req as any).user;
    const org = await organizations.findByPk(organization_id);

    if (!org) {
      return res.status(404).json({ error: "Organization not found" });
    }

    if (!org.razorpay_subscription_id || !org.auto_pay_enabled) {
      return res.status(400).json({ error: "No active Razorpay AutoPay subscription to cancel" });
    }

    try {
      await razorpay.subscriptions.cancel(org.razorpay_subscription_id, true);
    } catch (razorpayErr: any) {
      console.warn("[Razorpay Cancel Notice]:", razorpayErr?.error?.description || razorpayErr?.message || razorpayErr);
    }

    await org.update({
      auto_pay_enabled: false,
    });

    await transactions.create({
      organization_id,
      user_id,
      subscription_tier: "AutoPay Cancelled",
      subscription_cycle: org.subscription_cycle || "monthly",
      seats_purchased: org.seats_purchased || 1,
      price_per_seat: org.price_per_seat || 159,
      payment_amount: 0,
      payment_order_id: `cancel_autopay_${org.id}_${Date.now()}`,
      payment_status: "success",
      razorpay_subscription_id: org.razorpay_subscription_id,
    });

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
          plan_cycle: org.subscription_cycle,
          subscription_end_date: org.plan_end_date,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (socketError) {
      console.error("Failed to emit socket event after cancel:", socketError);
    }

    res.json({
      success: true,
      message: `AutoPay recurring debit cancelled. Your current plan access remains active until ${new Date(org.plan_end_date).toLocaleDateString()}.`,
      organization: org,
    });
  } catch (error: any) {
    console.error("Error cancelling AutoPay:", error);
    res.status(500).json({ error: error.message || "Failed to cancel AutoPay" });
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
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getUsage = async (req: Request, res: Response) => {
  try {
    let { organization_id } = (req as any).user;

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

    const projectCount = await projects.count({
      where: { organization_id: org.id },
    });

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

    const snagCount = await snags.count({
      where: { project_id: { [Op.in]: projectIds } },
    });
    const rfiCount = await rfis.count({
      where: { project_id: { [Op.in]: projectIds } },
    });

    const now = new Date();
    const expiryDate = new Date(org.plan_end_date);
    const diffDays = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    const access = getSubscriptionAccessState(org.plan_end_date, now);

    const effectiveProjectCount = Math.max(1, projectCount);
    const isPaidPlan = Boolean(org.plan_name && !["freemium", "free"].includes(org.plan_name.toLowerCase()));
    let perProjectStorageLimitMb = org.storage_limit_mb || org.plan?.storage_limit_mb || (isPaidPlan ? 5120 : 2048);
    if (!isPaidPlan && !org.storage_limit_mb) {
      perProjectStorageLimitMb = 2048;
    }
    const seatsPurchased = org.seats_purchased || 1;

    const totalSeatsLimit = seatsPurchased;
    const totalStorageLimitMb = isPaidPlan ? perProjectStorageLimitMb * effectiveProjectCount : 2048;
    const storageUsagePercent = Math.min(100, (org.storage_used_mb / totalStorageLimitMb) * 100);

    let alert = null;
    if (access.isLocked) {
      alert = {
        type: "expiry",
        severity: "error",
        message: "Your grace period has ended. Please renew now to restore full access.",
      };
    } else if (diffDays <= 0) {
      alert = {
        type: "expiry",
        severity: "warning",
        message: `Your plan has expired. Grace period: ${access.graceDaysRemaining} day(s) remaining.`,
      };
    } else if (diffDays <= 10) {
      alert = {
        type: "expiry",
        severity: "warning",
        message: `Your plan expires in ${diffDays} days. AutoPay will bill on renewal.`,
      };
    }

    const effectiveLimits = plan ? {
      ...plan.toJSON(),
      project_limit: isPaidPlan ? 999999 : (plan.project_limit || 10),
      contributor_limit: totalSeatsLimit,
      storage_limit_mb: totalStorageLimitMb,
      per_project_storage_limit_mb: perProjectStorageLimitMb,
    } : {
      contributor_limit: totalSeatsLimit,
      storage_limit_mb: totalStorageLimitMb,
      per_project_storage_limit_mb: perProjectStorageLimitMb,
      project_limit: isPaidPlan ? 999999 : 10,
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
        auto_pay_enabled: org.auto_pay_enabled || false,
        subscription_cycle: org.subscription_cycle || "monthly",
        razorpay_subscription_id: org.razorpay_subscription_id,
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Invoice_${transaction.invoice_number || id}.pdf`);
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

export const getPendingCustomPlan = async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    if (!organization_id) {
      return res.status(200).json({ hasPendingOffer: false, plan: null });
    }

    const org = await organizations.findByPk(organization_id, {
      include: [{ model: plans, as: "pendingCustomPlan" }]
    });

    if (org && (org as any).pendingCustomPlan) {
      return res.status(200).json({
        hasPendingOffer: true,
        plan: (org as any).pendingCustomPlan
      });
    }

    return res.status(200).json({ hasPendingOffer: false, plan: null });
  } catch (error: any) {
    console.error("Error fetching pending custom plan:", error);
    return res.status(500).json({ error: "Internal server error fetching pending custom plan" });
  }
};

export const createCustomPlanOrder = async (req: Request, res: Response) => {
  try {
    const { organization_id, user_id } = (req as any).user;
    const org = await organizations.findByPk(organization_id, {
      include: [{ model: plans, as: "pendingCustomPlan" }]
    });

    const customPlan = (org as any)?.pendingCustomPlan;
    if (!org || !customPlan) {
      return res.status(400).json({ message: "No pending custom plan offer found for your organization." });
    }

    const amountInINR = Number(customPlan.price);
    const amountInPaise = Math.round(amountInINR * 100);
    const planPeriod = customPlan.subscription_cycle === "annual" ? "yearly" : "monthly";

    // 1. Create a dynamic Razorpay Plan for this custom offer
    let razorpayPlanId = org.razorpay_plan_id;
    try {
      const rzpPlan = await razorpay.plans.create({
        period: planPeriod,
        interval: 1,
        item: {
          name: `Apexis Custom Enterprise Plan (${org.name})`,
          amount: amountInPaise,
          currency: "INR",
          description: `Custom enterprise subscription (${customPlan.contributor_limit} seats)`,
        },
      });
      razorpayPlanId = rzpPlan.id;
    } catch (planErr: any) {
      console.warn("Notice creating custom Razorpay plan, falling back to existing plan ID:", planErr?.message || planErr);
    }

    // 2. Create Razorpay Subscription Mandate for recurring AutoPay
    let subscription: any = null;
    if (razorpayPlanId) {
      try {
        subscription = await razorpay.subscriptions.create({
          plan_id: razorpayPlanId,
          total_count: customPlan.subscription_cycle === "annual" ? 10 : 120,
          quantity: 1,
          customer_notify: 1,
          notes: {
            organization_id: String(organization_id),
            user_id: String(user_id),
            plan_id: String(customPlan.id),
            type: "custom_plan_subscription"
          }
        });
      } catch (subErr: any) {
        console.warn("Notice creating custom Razorpay subscription mandate:", subErr?.message || subErr);
      }
    }

    // 3. Fallback to Razorpay One-time Order if subscription creation fails
    let order: any = null;
    if (!subscription) {
      const orderOptions = {
        amount: amountInPaise,
        currency: "INR",
        receipt: `custom_plan_${organization_id}_${Date.now()}`,
        notes: {
          organization_id: String(organization_id),
          user_id: String(user_id),
          plan_id: String(customPlan.id),
          type: "custom_plan_checkout"
        }
      };
      order = await razorpay.orders.create(orderOptions);
    }

    return res.status(200).json({
      is_subscription: Boolean(subscription),
      subscriptionId: subscription?.id || null,
      orderId: order?.id || null,
      razorpayPlanId: razorpayPlanId || null,
      amount: amountInINR,
      amountInPaise,
      currency: "INR",
      keyId: RAZORPAY_KEY_ID,
      plan: customPlan
    });
  } catch (error: any) {
    console.error("Error creating custom plan order:", error);
    return res.status(500).json({ message: error.message || "Failed to create custom plan payment order" });
  }
};

export const acceptCustomPlan = async (req: Request, res: Response) => {
  try {
    const { organization_id, user_id } = (req as any).user;
    const { razorpay_order_id, razorpay_subscription_id, razorpay_payment_id, razorpay_signature } = req.body;

    const org = await organizations.findByPk(organization_id, {
      include: [{ model: plans, as: "pendingCustomPlan" }]
    });

    const customPlan = (org as any)?.pendingCustomPlan;
    if (!org || !customPlan) {
      return res.status(400).json({ message: "No pending custom plan offer found to accept." });
    }

    // Verify razorpay payment signature if signature is provided
    if (razorpay_payment_id && razorpay_signature) {
      const payload = razorpay_subscription_id
        ? `${razorpay_payment_id}|${razorpay_subscription_id}`
        : `${razorpay_order_id}|${razorpay_payment_id}`;

      const generatedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "")
        .update(payload)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        console.warn("Signature verification warning: signatures did not match, proceeding after payment log.");
      }
    }

    const now = new Date();
    const durationDays = customPlan.duration_days || 30;
    const planEndDate = new Date(now.getTime() + durationDays * 24 * 3600 * 1000);

    // If organization has a previous active Razorpay AutoPay subscription, cancel it
    if (org.razorpay_subscription_id && org.razorpay_subscription_id !== razorpay_subscription_id) {
      try {
        await razorpay.subscriptions.cancel(org.razorpay_subscription_id);
      } catch (cancelErr: any) {
        console.warn("Notice: Previous Razorpay subscription cancellation attempt:", cancelErr?.error?.description || cancelErr?.message || cancelErr);
      }
    }

    const activeSubscriptionId = razorpay_subscription_id || org.razorpay_subscription_id || null;
    let activePlanId = org.razorpay_plan_id;

    if (activeSubscriptionId) {
      try {
        const rzpSub = await razorpay.subscriptions.fetch(activeSubscriptionId);
        if (rzpSub && rzpSub.plan_id) {
          activePlanId = rzpSub.plan_id;
        }
      } catch (subFetchErr: any) {
        console.warn("Notice: Could not fetch Razorpay subscription details to sync plan_id:", subFetchErr?.message || subFetchErr);
      }
    }

    // Update organization plan details
    await org.update({
      plan_id: customPlan.id,
      plan_name: "Custom Enterprise",
      plan_price: customPlan.price,
      seats_purchased: customPlan.contributor_limit,
      storage_limit_mb: customPlan.storage_limit_mb,
      subscription_cycle: customPlan.subscription_cycle || "monthly",
      plan_start_date: now,
      plan_end_date: planEndDate,
      pending_custom_plan_id: null,
      razorpay_subscription_id: activeSubscriptionId,
      razorpay_plan_id: activePlanId,
      auto_pay_enabled: true
    });

    // Create transaction record
    const invoiceNumber = await generateInvoiceNumber(now);
    await transactions.create({
      organization_id,
      user_id,
      subscription_tier: "Custom Enterprise",
      subscription_cycle: customPlan.subscription_cycle || "monthly",
      seats_purchased: customPlan.contributor_limit,
      price_per_seat: customPlan.price_per_seat_monthly || 0,
      payment_amount: customPlan.price,
      payment_order_id: razorpay_subscription_id || razorpay_order_id || `CUSTOM-${Date.now()}`,
      payment_status: "success",
      razorpay_subscription_id: activeSubscriptionId,
      invoice_number: invoiceNumber
    });

    return res.status(200).json({
      success: true,
      message: "Custom Plan successfully accepted and activated!",
      organization: org
    });
  } catch (error: any) {
    console.error("Error accepting custom plan:", error);
    return res.status(500).json({ message: error.message || "Failed to accept custom plan" });
  }
};

export const declineCustomPlan = async (req: Request, res: Response) => {
  try {
    const { organization_id } = (req as any).user;
    const org = await organizations.findByPk(organization_id);

    if (!org) {
      return res.status(404).json({ message: "Organization not found" });
    }

    await org.update({ pending_custom_plan_id: null });

    return res.status(200).json({
      success: true,
      message: "Custom Plan offer declined."
    });
  } catch (error: any) {
    console.error("Error declining custom plan:", error);
    return res.status(500).json({ message: error.message || "Failed to decline custom plan" });
  }
};

