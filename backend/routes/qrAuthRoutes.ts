import { Router } from "express";
import { generateQrSession, authorizeQrSession, getActiveQrSessions, revokeQrSession, revokeAllUserQrSessions } from "../controllers/qrAuthController.ts";
import { verifyToken } from "../middleware/verifyToken.ts";

const router = Router();

// Public route to generate a QR UUID and start a pending session
router.get("/generate", generateQrSession);

// Protected route hit by the logged-in mobile app to authorize the Web UUID
router.post("/authorize", verifyToken, authorizeQrSession);

// Protected route to list active sessions
router.get("/sessions", verifyToken, getActiveQrSessions);

// Protected route to revoke ALL active web sessions for the user
router.delete("/sessions/all", verifyToken, revokeAllUserQrSessions);

// Protected route to revoke an active web session
router.delete("/sessions/:sessionId", verifyToken, revokeQrSession);

export default router;
