import { Router } from "express";
import multer from "multer";
import { uploadFile, listFiles, deleteFile, toggleFileVisibility, viewFile } from "../controllers/fileController.ts";
import { verifyToken, isNotClient } from "../middleware/verifyToken.ts";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Apply verifyToken to all specific project/file routes below
router.use(verifyToken);

// Secure view route for images
router.post("/view", viewFile);

router.post("/upload", isNotClient, upload.single('file'), uploadFile);
router.get("/:projectId", listFiles);
router.delete("/:fileId", deleteFile);
router.put("/:fileId/visibility", toggleFileVisibility);

export default router;
