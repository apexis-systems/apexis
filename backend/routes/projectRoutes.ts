import { Router } from "express";
import { createProject, getProjects } from "../controllers/projectController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all project management routes
router.use(verifyToken);

router.post("/", isAdmin, createProject);
router.get("/", getProjects);

export default router;
