import { Router } from "express";
import { uploadFile, listFiles, deleteFile } from "../controllers/fileController.ts";
import { verifyToken, isNotClient } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all file routes
router.use(verifyToken);

router.post("/upload", isNotClient, uploadFile);
router.get("/:projectId", listFiles);
router.delete("/:fileId", deleteFile);

export default router;
