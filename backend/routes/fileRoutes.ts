import { Router } from "express";
import { uploadFile, listFiles } from "../controllers/fileController.ts";
import { verifyToken, isContributorOrClient } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all file routes
router.use(verifyToken);

router.post("/upload", uploadFile);
router.get("/:projectId", listFiles);

export default router;
