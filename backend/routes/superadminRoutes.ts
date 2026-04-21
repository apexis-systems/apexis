import { Router } from "express";
import { 
    getOrgOverview, 
    getSuperAdmins, 
    getOrganizations, 
    inviteSuperAdmin, 
    deleteSuperAdmin,
    getDashboardOverview,
    getGrowthAnalytics,
    getRevenueMetrics,
    getFreemiumLeadList
} from "../controllers/superadminController.ts";
import { verifyToken, isSuperAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all superadmin routes
router.use(verifyToken);
router.use(isSuperAdmin);

router.get("/overview", getOrgOverview);
router.get("/dashboard/overview", getDashboardOverview);
router.get("/dashboard/growth", getGrowthAnalytics);
router.get("/dashboard/revenue", getRevenueMetrics);
router.get("/dashboard/leads", getFreemiumLeadList);
router.get("/teams", getSuperAdmins);
router.get("/organizations", getOrganizations);
router.post("/invite", inviteSuperAdmin);
router.delete("/teams/:id", deleteSuperAdmin);

export default router;
