import { Router } from "express";
import { superadminLogin, adminLogin, projectLogin, me } from "../controllers/authController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

// Logins
router.post("/superadmin/login", superadminLogin);
router.post("/admin/login", adminLogin);
router.post("/project/login", projectLogin);

// Current User Profile
router.get("/me", verifyToken, me);

export default router;
