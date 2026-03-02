import { Router } from "express";
import multer from "multer";
import { uploadFile, listFiles, deleteFile, toggleFileVisibility } from "../controllers/fileController.ts";
import { verifyToken, isNotClient } from "../middleware/verifyToken.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply verifyToken to all file routes
router.use(verifyToken);

router.post("/upload", isNotClient, upload.single('file'), uploadFile);
router.get("/:projectId", listFiles);
router.delete("/:fileId", deleteFile);
router.put("/:fileId/visibility", toggleFileVisibility);

export default router;
