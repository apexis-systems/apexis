import { Router } from "express";
import multer from "multer";
import { uploadFile, uploadScans, listFiles, deleteFile, toggleFileVisibility, viewFile, bulkUpdateFiles, toggleDoNotFollow } from "../controllers/fileController.ts";
import { verifyToken, isNotClient } from "../middleware/verifyToken.ts";
import { checkLimit } from "../middleware/checkLimit.ts";

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

// Apply verifyToken to all specific project/file routes below
router.use(verifyToken);

// Secure view route for images
router.post("/view", viewFile);

router.post("/upload", isNotClient, upload.single('file'), checkLimit('storage'), uploadFile);
router.post("/upload-scans", isNotClient, upload.array('files'), checkLimit('storage'), uploadScans);

router.get("/:projectId", listFiles);
router.put("/bulk", bulkUpdateFiles);
router.delete("/:fileId", deleteFile);
router.put("/:fileId/visibility", toggleFileVisibility);
router.patch("/:fileId/do-not-follow", toggleDoNotFollow);

export default router;
