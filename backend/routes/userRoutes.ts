import { Router } from "express";
import { inviteUser, getOrgUsers } from "../controllers/userController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all team management routes
router.use(verifyToken);

router.post("/invite", isAdmin, inviteUser);
router.get("/", isAdmin, getOrgUsers);

export default router;
