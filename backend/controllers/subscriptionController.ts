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
      const { amount, currency, plan_name, plan_cycle } = req.body;
      const requestedAmount = Number(amount);

      if (!amount || !currency || !plan_name || !plan_cycle) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      if (!["monthly", "annual"].includes(String(plan_cycle))) {
        return res.status(400).json({ message: "Invalid plan cycle" });
      }

      const selectedPlan = await plans.findOne({
        where: { name: plan_name, is_active: true },
      });
      if (!selectedPlan) {
        return res.status(404).json({ message: "Plan not found" });
      }

      const basePlanPrice = Number((selectedPlan as any).price);
      if (!Number.isFinite(basePlanPrice) || basePlanPrice <= 0) {
        return res.status(400).json({ message: "Invalid plan price configuration" });
      }

      const cycleMultiplier = plan_cycle === "annual" ? 12 : 1;
      const preTaxAmount = basePlanPrice * cycleMultiplier;
      const normalizedAmount = Number((preTaxAmount * (1 + GST_RATE)).toFixed(2));

      if (
        Number.isFinite(requestedAmount) &&
        Math.abs(requestedAmount - normalizedAmount) > 1 &&
        Math.abs(requestedAmount - preTaxAmount) > 1
      ) {
        console.warn(
          `createOrder amount mismatch for plan "${plan_name}" (${plan_cycle}): requested=${requestedAmount}, expected=${normalizedAmount}`,
        );
      }
      if (normalizedAmount > RAZORPAY_MAX_ORDER_AMOUNT_INR) {
        return res.status(400).json({
          message: `Amount exceeds Razorpay maximum allowed per order (INR ${RAZORPAY_MAX_ORDER_AMOUNT_INR.toLocaleString("en-IN")}).`,
        });
      }

      // Check if organization already has this plan active
      const org = await organizations.findByPk(organization_id);
      if (org && org.plan_name === plan_name) {
        const now = new Date();
        const endDate = new Date(org.plan_end_date);
        if (endDate > now) {
          return res.status(400).json({
            message: `You already have an active ${plan_name} subscription until ${endDate.toLocaleDateString()}.`,
          });
        }
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
        subscription_tier: plan_name,
        subscription_cycle: plan_cycle,
        payment_amount: normalizedAmount,
        payment_order_id: order.id,
        payment_status: "pending",
      });

      res.status(201).json({ order });
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

    // Update organization subscription
    // Support case-insensitive plan matching
    const selectedPlan = await plans.findOne({
      where: {
        name: plan_name,
      },
    });

    if (!selectedPlan) {
      console.error(`Plan not found: ${plan_name}`);
      // We still marked transaction as success, but couldn't update org.
      // In a real app, you might want to handle this better.
      return res.status(404).json({ message: "Plan not found in database" });
    }

    const planStartDate = new Date();
    const planEndDate = new Date();
    if (plan_cycle === "annual") {
      planEndDate.setFullYear(planEndDate.getFullYear() + 1);
    } else {
      planEndDate.setMonth(planEndDate.getMonth() + 1);
    }

    await organizations.update(
      {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.name,
        plan_price: selectedPlan.price,
        plan_start_date: planStartDate,
        plan_end_date: planEndDate,
        storage_limit_mb: selectedPlan.storage_limit_mb,
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
    const { organization_id } = (req as any).user;

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
    const contributorCount = await users.count({
      where: { organization_id: org.id, role: "contributor" },
    });
    const clientCount = await users.count({
      where: { organization_id: org.id, role: "client" },
    });

    // 3. Calculate Snag & RFI Usage (across all projects)
    const projectIds = (
      await projects.findAll({
        where: { organization_id: org.id },
        attributes: ["id"],
      })
    ).map((p: any) => p.id);

    const snagCount = await snags.count({
      where: { project_id: { [Op.in]: projectIds } },
    });
    const rfiCount = await rfis.count({
      where: { project_id: { [Op.in]: projectIds } },
    });

    // 4. Proactive Alert Logic (Expiry & Storage)
    const now = new Date();
    const expiryDate = new Date(org.plan_end_date);
    const diffDays = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 3600 * 24),
    );
    const access = getSubscriptionAccessState(org.plan_end_date, now);

    const storageUsagePercent =
      (org.storage_used_mb / org.storage_limit_mb) * 100;

    let alert = null;

    // Prioritize whichever limit is closer
    // 10 days for expiry, 90% for storage
    if (diffDays <= 10 || storageUsagePercent >= 90) {
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
      } else if (storageUsagePercent >= 100) {
        alert = {
          type: "storage",
          severity: "error",
          message:
            "Storage limit reached. Delete files or upgrade to upload more.",
        };
      } else if (
        diffDays <= 10 &&
        (storageUsagePercent < 90 || diffDays < 100 - storageUsagePercent)
      ) {
        // If expiry is closer or storage isn't critical yet
        alert = {
          type: "expiry",
          severity: "warning",
          message: `Your plan expires in ${diffDays} days. Upgrade now to avoid service interruption.`,
        };
      } else {
        alert = {
          type: "storage",
          severity: "warning",
          message: `You have used ${Math.round(storageUsagePercent)}% of your storage. Consider upgrading soon.`,
        };
      }
    }

    res.status(200).json({
      plan: {
        name: org.plan_name,
        startDate: org.plan_start_date,
        endDate: org.plan_end_date,
        daysRemaining: Math.max(0, diffDays),
        limits: plan,
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
        contributors: contributorCount,
        clients: clientCount,
        snags: snagCount,
        rfis: rfiCount,
        storage_mb: org.storage_used_mb,
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
