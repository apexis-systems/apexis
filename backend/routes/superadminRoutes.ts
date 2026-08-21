import { Router } from "express";
import { 
    getOrgOverview, 
    getSuperAdmins, 
    getOrganizations, 
    inviteSuperAdmin, 
    deleteSuperAdmin,
    getDashboardOverview,
    getFilteredActivities,
    getGrowthAnalytics,
    getRevenueMetrics,
    getFreemiumLeadList,
    getAllLeadList,
    getOrganizationDetails,
    getUsersList,
    sendBroadcastNotification,
    updateSystemConfig,
    extendOrganizationTrials,
    createCustomPlanOffer,
    getPendingCustomPlanForOrg,
    activateCustomPlan,
    getCustomPlanInvoiceDetails,
    sendCustomPlanInvoice
} from "../controllers/superadminController.ts";
import { verifyToken, isSuperAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all superadmin routes
router.use(verifyToken);
router.use(isSuperAdmin);

router.get("/overview", getOrgOverview);
router.get("/dashboard/overview", getDashboardOverview);
router.get("/dashboard/activities", getFilteredActivities);

router.get("/dashboard/growth", getGrowthAnalytics);
router.get("/dashboard/revenue", getRevenueMetrics);
router.get("/dashboard/leads", getFreemiumLeadList);
router.get("/dashboard/leads/all", getAllLeadList);
router.get("/teams", getSuperAdmins);
router.get("/organizations", getOrganizations);
router.get("/organizations/:id", getOrganizationDetails);
router.get("/users", getUsersList);
router.post("/broadcast", sendBroadcastNotification);
router.post("/invite", inviteSuperAdmin);
router.delete("/teams/:id", deleteSuperAdmin);
router.put("/system-config", updateSystemConfig);
router.post("/organizations/extend-trial", extendOrganizationTrials);
router.post("/custom-plan/create", createCustomPlanOffer);
router.get("/custom-plan/:organizationId", getPendingCustomPlanForOrg);
router.post("/custom-plan/activate", activateCustomPlan);
router.get("/custom-plan/invoice-details/:organizationId", getCustomPlanInvoiceDetails);
router.post("/custom-plan/send-invoice", sendCustomPlanInvoice);

export default router;
