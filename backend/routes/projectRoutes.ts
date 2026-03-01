import { Router } from "express";
import { createProject, getProjects, getProjectById } from "../controllers/projectController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all project management routes
router.use(verifyToken);

router.post("/", isAdmin, createProject);
router.get("/", getProjects);
router.get("/:id", getProjectById);

export default router;
