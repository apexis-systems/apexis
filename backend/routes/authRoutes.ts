import { Router } from "express";
import { superadminLogin, adminLogin, projectLogin, me, verifyInvitation, completeOnboarding } from "../controllers/authController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

// Logins
router.post("/superadmin/login", superadminLogin);
router.post("/admin/login", adminLogin);
router.post("/project/login", projectLogin);

// Current User Profile
router.get("/me", verifyToken, me);

// Invitation / Onboarding
router.get("/verify-invitation", verifyInvitation);
router.post("/complete-onboarding", completeOnboarding);

export default router;
