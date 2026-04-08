import { Router } from "express";
import { inviteUser, getOrgUsers, deleteUser, updatePushToken, updateProfilePic, updateUserName, getOnboardingLinks } from "../controllers/userController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";
import { checkLimit } from "../middleware/checkLimit.ts";

const router = Router();

// Apply verifyToken to all team management routes
router.use(verifyToken);

router.post("/invite", isAdmin, checkLimit('member'), inviteUser);
router.get("/onboarding-links", isAdmin, getOnboardingLinks);
router.get("/", getOrgUsers);
router.delete("/:id", isAdmin, deleteUser);

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.patch("/push-token", updatePushToken);
router.patch("/profile-pic", upload.single('profile_pic'), updateProfilePic);
router.patch("/name", updateUserName);

export default router;
