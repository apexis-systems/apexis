import { Router } from "express";
import { uploadLogo } from "../controllers/organizationController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload organization logo (only admins / superadmins)
router.post("/logo", verifyToken, upload.single("logo"), uploadLogo);

export default router;
