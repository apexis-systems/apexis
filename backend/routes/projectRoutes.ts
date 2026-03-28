import { Router } from "express";
import { createProject, getProjects, getProjectById, updateProject, exportHandoverPackage, getLatestExport, getProjectShareLinks } from "../controllers/projectController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all project management routes
router.use(verifyToken);

router.post("/", isAdmin, createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.get("/:id/share-links", isAdmin, getProjectShareLinks);
router.patch("/:id", isAdmin, updateProject);
router.post("/:id/export-handover", isAdmin, exportHandoverPackage);
router.get("/:id/export-handover", isAdmin, getLatestExport);

export default router;
