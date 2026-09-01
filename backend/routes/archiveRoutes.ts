import { Router } from "express";
import {
    archiveProjectHandler,
    getArchivedProjectsHandler,
    getArchiveDownloadUrlHandler,
    restoreProjectArchiveHandler,
    deleteArchivedProjectHandler,
} from "../controllers/archiveController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply auth & admin checks to all archive routes
router.use(verifyToken, isAdmin);

// Archive / Zip Project
router.post("/:id/archive", archiveProjectHandler);

// List all archived projects for current organization
router.get("/", getArchivedProjectsHandler);

// Get presigned download URL for archive ZIP
router.get("/:archiveId/download", getArchiveDownloadUrlHandler);

// Unzip / Restore project to active org
router.post("/:archiveId/restore", restoreProjectArchiveHandler);

// Permanently delete archive record & S3 zip
router.delete("/:archiveId", deleteArchivedProjectHandler);

export default router;
