import { Router } from "express";
import {
    superadminLogin,
    adminLogin,
    projectLogin,
    me,
    verifyInvitation,
    completeOnboarding,
    forgotPasswordRequestOtp,
    forgotPasswordVerifyOtp,
    resetPassword,
    changePassword,
    verifyOnboardingToken,
    completePublicSignup,
    getMyMemberships,
    switchContext,
    updateDiagnosticPermission
} from "../controllers/authController.ts";
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

// Public Onboarding
router.get("/verify-onboarding-token", verifyOnboardingToken);
router.post("/complete-public-signup", completePublicSignup);

// Password Management
router.post("/forgot-password/request-otp", forgotPasswordRequestOtp);
router.post("/forgot-password/verify-otp", forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", resetPassword);
router.post("/change-password", verifyToken, changePassword);

// Context Switching
router.get("/memberships", verifyToken, getMyMemberships);
router.post("/switch-context", verifyToken, switchContext);
router.patch("/diagnostic-permission", verifyToken, updateDiagnosticPermission);

export default router;
