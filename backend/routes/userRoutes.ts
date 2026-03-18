import { Router } from "express";
import { inviteUser, getOrgUsers, deleteUser, updatePushToken, updateProfilePic, updateUserName } from "../controllers/userController.ts";
import { verifyToken, isAdmin } from "../middleware/verifyToken.ts";

const router = Router();

// Apply verifyToken to all team management routes
router.use(verifyToken);

router.post("/invite", isAdmin, inviteUser);
router.get("/", getOrgUsers);
router.delete("/:id", isAdmin, deleteUser);

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });

router.patch("/push-token", updatePushToken);
router.patch("/profile-pic", upload.single('profile_pic'), updateProfilePic);
router.patch("/name", updateUserName);

export default router;
