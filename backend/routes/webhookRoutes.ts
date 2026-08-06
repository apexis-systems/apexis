import { Router } from "express";
import { handleRazorpayWebhook } from "../controllers/webhookController.ts";

const router = Router();

// Razorpay Webhook Endpoint (No JWT auth required)
router.post("/razorpay", handleRazorpayWebhook);

export default router;
