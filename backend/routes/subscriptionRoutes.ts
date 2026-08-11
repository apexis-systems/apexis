import { Router } from "express";
import {
  createOrder,
  verifyPayment,
  getTransactions,
  getUsage,
  getPlans,
  getInvoice,
  validateSeatChange,
  cancelAutoPaySubscription,
  getPendingCustomPlan,
  createCustomPlanOrder,
  acceptCustomPlan,
  declineCustomPlan,
} from "../controllers/subscriptionController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

router.get("/plans", verifyToken, getPlans);
router.post("/create-order", verifyToken, createOrder);
router.post("/verify-payment", verifyToken, verifyPayment);
router.post("/cancel-autopay", verifyToken, cancelAutoPaySubscription);
router.get("/transactions", verifyToken, getTransactions);
router.get("/usage", verifyToken, getUsage);
router.get("/invoice/:id", verifyToken, getInvoice);
router.post("/validate-seat-change", verifyToken, validateSeatChange);

router.get("/custom-plan/pending", verifyToken, getPendingCustomPlan);
router.post("/custom-plan/create-order", verifyToken, createCustomPlanOrder);
router.post("/custom-plan/accept", verifyToken, acceptCustomPlan);
router.post("/custom-plan/decline", verifyToken, declineCustomPlan);

export default router;
