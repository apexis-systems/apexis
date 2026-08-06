import type { Request, Response } from "express";
import crypto from "crypto";
import { Op } from "sequelize";
import { organizations, transactions, users } from "../models/index.ts";
import { getIO } from "../socket.ts";
import { generateInvoice } from "../services/invoiceService.ts";

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

export const handleRazorpayWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!webhookSecret) {
      console.error("[Webhook Error]: RAZORPAY_WEBHOOK_SECRET is not configured in backend .env");
      return res.status(500).json({ error: "Webhook secret not configured on server" });
    }

    // Verify HMAC SHA-256 signature
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (!signature || signature !== expectedSignature) {
      console.warn("[Webhook Warning]: Invalid signature received");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const { event, payload } = req.body;
    console.log(`[Razorpay Webhook Received]: Event = ${event}`);

    if (event === "subscription.charged") {
      const subEntity = payload?.subscription?.entity;
      const paymentEntity = payload?.payment?.entity;

      if (!subEntity) {
        return res.status(400).json({ error: "Missing subscription entity in webhook payload" });
      }

      const subscriptionId = subEntity.id;
      const notesOrgId = subEntity.notes?.organization_id;
      const quantity = subEntity.quantity || 1;
      const paymentId = paymentEntity?.id;

      // Idempotency check: if transaction for this payment_id already exists, return ok
      if (paymentId) {
        const existingTx = await transactions.findOne({ where: { payment_id: paymentId } });
        if (existingTx) {
          console.log(`[Webhook Info]: Transaction for payment ${paymentId} already processed. Skipping duplicate.`);
          return res.status(200).json({ status: "ok", message: "Already processed" });
        }
      }

      // Find organization by razorpay_subscription_id or notes.organization_id
      let org = await organizations.findOne({
        where: { razorpay_subscription_id: subscriptionId },
      });

      if (!org && notesOrgId) {
        org = await organizations.findByPk(notesOrgId);
      }

      if (!org) {
        console.error(`[Webhook Error]: Organization not found for subscription ${subscriptionId}`);
        return res.status(404).json({ error: "Organization not found for subscription" });
      }

      const cycle = subEntity.notes?.plan_cycle || org.subscription_cycle || "monthly";
      const now = new Date();

      // Determine end date: prefer Razorpay's current_end timestamp if present
      let newEndDate: Date;
      if (subEntity.current_end && typeof subEntity.current_end === "number") {
        newEndDate = new Date(subEntity.current_end * 1000);
      } else {
        const currentEnd = org.plan_end_date ? new Date(org.plan_end_date) : now;
        const baseDate = currentEnd.getTime() > now.getTime() ? currentEnd : now;
        newEndDate = new Date(baseDate);
        if (cycle === "annual") {
          newEndDate.setFullYear(newEndDate.getFullYear() + 1);
        } else {
          newEndDate.setMonth(newEndDate.getMonth() + 1);
        }
      }

      const unitPrice = cycle === "annual" ? 99 : 159;
      const paidAmountInINR = paymentEntity?.amount
        ? paymentEntity.amount / 100
        : (cycle === "annual" ? quantity * 99 * 12 : quantity * 159);

      // Ensure plan_name is updated to "Starter" if previously Freemium/Free
      const currentPlanName = org.plan_name;
      const isFreemium = !currentPlanName || ["freemium", "free"].includes(currentPlanName.toLowerCase());
      const updatedPlanName = isFreemium ? "Starter" : currentPlanName;

      await org.update({
        plan_name: updatedPlanName,
        razorpay_subscription_id: subscriptionId,
        razorpay_plan_id: subEntity.plan_id || org.razorpay_plan_id,
        auto_pay_enabled: true,
        seats_purchased: quantity,
        price_per_seat: unitPrice,
        plan_start_date: org.plan_start_date || now,
        plan_end_date: newEndDate,
        subscription_cycle: cycle,
      });

      // Find org admin user for transaction log
      const adminUser = await users.findOne({
        where: { organization_id: org.id, role: "admin" },
        attributes: ["id"],
      });
      const userId = adminUser?.id || 1;

      const invoiceNum = await generateInvoiceNumber(now);

      const tx = await transactions.create({
        organization_id: org.id,
        user_id: userId,
        subscription_tier: `${updatedPlanName} (AutoPay)`,
        subscription_cycle: cycle,
        seats_purchased: quantity,
        price_per_seat: unitPrice,
        payment_amount: paidAmountInINR,
        payment_order_id: paymentEntity?.order_id || `sub_charge_${subscriptionId}_${Date.now()}`,
        payment_id: paymentId || `pay_${Date.now()}`,
        payment_signature: "WEBHOOK_VERIFIED",
        payment_status: "success",
        invoice_number: invoiceNum,
        razorpay_subscription_id: subscriptionId,
      });

      // Generate invoice PDF
      try {
        await generateInvoice((tx as any).id);
      } catch (invErr) {
        console.error("[Webhook Warning]: Failed to generate invoice PDF", invErr);
      }

      // Real-time socket notification to all org users
      try {
        const orgUsers = await users.findAll({
          where: { organization_id: org.id },
          attributes: ["id"],
        });
        const io = getIO();
        for (const u of orgUsers as any[]) {
          io.to(`user-${String(u.id)}`).emit("subscription-updated", {
            organization_id: org.id,
            plan_name: updatedPlanName,
            plan_cycle: cycle,
            subscription_end_date: newEndDate,
            updated_at: new Date().toISOString(),
          });
        }
      } catch (socketErr) {
        console.error("[Webhook Error]: Socket emission failed", socketErr);
      }

      console.log(`[Webhook Success]: AutoPay renewal processed for Org #${org.id}. Extended to ${newEndDate.toISOString()}`);
    } else if (event === "subscription.authenticated") {
      const subEntity = payload?.subscription?.entity;
      if (subEntity) {
        const notesOrgId = subEntity.notes?.organization_id;
        const whereClause = notesOrgId
          ? { [Op.or]: [{ razorpay_subscription_id: subEntity.id }, { id: notesOrgId }] }
          : { razorpay_subscription_id: subEntity.id };

        await organizations.update(
          { auto_pay_enabled: true, razorpay_subscription_id: subEntity.id },
          { where: whereClause }
        );
      }
    } else if (event === "subscription.halted" || event === "subscription.cancelled") {
      const subEntity = payload?.subscription?.entity;
      if (subEntity?.id) {
        // Only disable auto_pay_enabled if the cancelled/halted sub ID matches the org's current active subscription ID
        await organizations.update(
          { auto_pay_enabled: false },
          { where: { razorpay_subscription_id: subEntity.id } }
        );
      }
    }

    res.status(200).json({ status: "ok", received: true });
  } catch (error: any) {
    console.error("[Webhook Error]:", error);
    res.status(500).json({ error: error.message || "Webhook handling error" });
  }
};
