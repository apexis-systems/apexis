import { Router } from "express";
import { createOrder, verifyPayment, getTransactions, getUsage, getPlans, getInvoice } from "../controllers/subscriptionController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

router.get("/plans", verifyToken, getPlans);
router.post("/create-order", verifyToken, createOrder);
router.post("/verify-payment", verifyToken, verifyPayment);
router.get("/transactions", verifyToken, getTransactions);
router.get("/usage", verifyToken, getUsage);
router.get("/invoice/:id", verifyToken, getInvoice);

export default router;
