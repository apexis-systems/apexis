import { Router } from "express";
import { createProject, getProjects, getProjectById, updateProject, exportHandoverPackage, getLatestExport, getProjectShareLinks, getProjectMembers, removeProjectMember, deleteProject } from "../controllers/projectController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";
import { checkLimit } from "../middleware/checkLimit.ts";

const router = Router();

// Apply verifyToken to all project management routes
router.use(verifyToken);

router.post("/", isAdmin, checkLimit('project'), createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.get("/:id/members", getProjectMembers);
router.delete("/:id/members/:userId", isAdmin, removeProjectMember);
router.get("/:id/share-links", getProjectShareLinks);
router.patch("/:id", isAdmin, updateProject);
router.delete("/:id", isAdmin, deleteProject);
router.post("/:id/export-handover", isAdmin, checkLimit('export_handover'), exportHandoverPackage);
router.get("/:id/export-handover", isAdmin, getLatestExport);

export default router;
