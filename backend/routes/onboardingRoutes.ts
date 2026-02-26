import { Router } from "express";
import {
    superadminRequestOtp,
    superadminVerifyOtp,
    adminRequestOtp,
    adminVerifyOtp
} from "../controllers/onboardingController.ts";

const router = Router();

// SuperAdmin Signup
router.post("/superadmin/signup/request-otp", superadminRequestOtp);
router.post("/superadmin/signup/verify-otp", superadminVerifyOtp);

// Admin Signup
router.post("/admin/signup/request-otp", adminRequestOtp);
router.post("/admin/signup/verify-otp", adminVerifyOtp);

export default router;
