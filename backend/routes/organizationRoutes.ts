import { Router } from "express";
import { uploadLogo, updateOrganization, getOrgPhotos } from "../controllers/organizationController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";
import multer from "multer";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Upload organization logo (only admins / superadmins)
router.post("/logo", verifyToken, upload.single("logo"), uploadLogo);

// Fetch organization photos (only admins / superadmins)
router.get("/photos", verifyToken, isAdmin, getOrgPhotos);

// Update organization details
router.patch("/", verifyToken, updateOrganization);

export default router;
