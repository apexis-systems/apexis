import { Router } from "express";
import { createOrder, verifyPayment, getTransactions } from "../controllers/subscriptionController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

router.post("/create-order", verifyToken, createOrder);
router.post("/verify-payment", verifyToken, verifyPayment);
router.get("/transactions", verifyToken, getTransactions);

export default router;
