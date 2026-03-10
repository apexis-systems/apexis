import { Router } from "express";
import { getOrgOverview, getSuperAdmins, getOrganizations } from "../controllers/superadminController.ts";
import { verifyToken, isSuperAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all superadmin routes
router.use(verifyToken);
router.use(isSuperAdmin);

router.get("/overview", getOrgOverview);
router.get("/teams", getSuperAdmins);
router.get("/organizations", getOrganizations);

export default router;
