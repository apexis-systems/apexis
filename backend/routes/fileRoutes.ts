import { Router } from "express";
import multer from "multer";
import { uploadFile, uploadScans, listFiles, deleteFile, bulkDeleteFiles, viewFile, bulkUpdateFiles, updateFile, archiveFile, unarchiveFile, downloadFile, markFileSeen, confirmScreenshot, getFileVersions, promoteFile } from "../controllers/fileController.ts";
import { linkFiles, getLinkedItems, deleteLink } from "../controllers/linkController.ts";
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
router.post("/confirm-screenshot", isNotClient, upload.single('file'), checkLimit('storage'), confirmScreenshot);

router.get("/:fileId/versions", getFileVersions);
router.post("/:fileId/promote", promoteFile);

router.get("/:projectId", listFiles);
router.get("/download/:fileId", downloadFile);
router.put("/bulk", bulkUpdateFiles);
router.post("/bulk-delete", bulkDeleteFiles);
router.put("/:fileId", updateFile);
router.put("/:fileId/archive", archiveFile);
router.put("/:fileId/unarchive", unarchiveFile);
router.patch("/:fileId/seen", markFileSeen);
router.delete("/:fileId", deleteFile);

router.post("/:id/link", linkFiles);
router.get("/:id/links", getLinkedItems);
router.delete("/:id/link/:targetType/:targetId", deleteLink);

export default router;
