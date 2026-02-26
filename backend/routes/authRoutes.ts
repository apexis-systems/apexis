import { Router } from "express";
import { superadminLogin, adminLogin, projectLogin } from "../controllers/authController.ts";

const router = Router();

// Logins
router.post("/superadmin/login", superadminLogin);
router.post("/admin/login", adminLogin);
router.post("/project/login", projectLogin);

export default router;
