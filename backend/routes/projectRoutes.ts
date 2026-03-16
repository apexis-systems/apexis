import { Router } from "express";
import { createProject, getProjects, getProjectById, updateProject } from "../controllers/projectController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all project management routes
router.use(verifyToken);

router.post("/", isAdmin, createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);
router.patch("/:id", isAdmin, updateProject);

export default router;
