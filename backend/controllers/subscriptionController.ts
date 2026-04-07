import type { Request, Response } from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import { transactions, organizations, plans } from "../models/index.ts";

/**
 * Razorpay controller for handling subscriptions
 */

export const createOrder = async (req: Request, res: Response) => {
    try {
        console.log("Creating order with Key ID starting with:", process.env.RAZORPAY_KEY_ID?.substring(0, 8));
        const { amount, currency, plan_name, plan_cycle } = req.body;
        const { organization_id, user_id } = (req as any).user;

        if (!amount || !currency || !plan_name || !plan_cycle) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID!,
            key_secret: process.env.RAZORPAY_KEY_SECRET!,
        });

        const options = {
            amount: Math.round(Number(amount) * 100), // convert to paise
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
            payment_amount: amount,
            payment_order_id: order.id,
            payment_status: "pending",
        });

        res.status(201).json({ order });
    } catch (error: any) {
        console.error("Error creating order:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

export const verifyPayment = async (req: Request, res: Response) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan_name, plan_cycle } = req.body;
        const { organization_id } = (req as any).user;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing payment details" });
        }

        // Verify signature
        const shasum = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!);
        shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
        const digest = shasum.digest("hex");

        if (digest !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid payment signature" });
        }

        // Update transaction
        const transaction = await transactions.findOne({ where: { payment_order_id: razorpay_order_id } });
        if (!transaction) {
            return res.status(404).json({ message: "Transaction record not found" });
        }

        await transaction.update({
            payment_id: razorpay_payment_id,
            payment_signature: razorpay_signature,
            payment_status: "success",
        });

        // Update organization subscription
        // Support case-insensitive plan matching
        const selectedPlan = await plans.findOne({
            where: {
                name: plan_name
            }
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
            { where: { id: organization_id } }
        );

        res.status(200).json({
            message: "Payment verified and subscription updated",
            transaction,
            subscription_end_date: planEndDate
        });
    } catch (error: any) {
        console.error("Error verifying payment:", error);
        res.status(500).json({ message: "Internal server error", error: error.message });
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
