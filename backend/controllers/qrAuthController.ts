import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redisClient } from '../utils/redisObject.ts';
import jwt from 'jsonwebtoken';
import { getIO } from '../socket.ts';

// Types
interface AuthRequest extends Request {
    user?: any; // From verifyToken middleware
}

export const generateQrSession = async (req: Request, res: Response) => {
    try {
        const sessionId = uuidv4();

        // Store in Redis with a 2-minute expiration
        // Value can be a JSON string with status
        await redisClient.set(`qr_session:${sessionId}`, JSON.stringify({ status: 'pending' }), 'EX', 120);

        return res.status(200).json({ sessionId });
    } catch (error) {
        console.error("Error generating QR session:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const authorizeQrSession = async (req: AuthRequest, res: Response) => {
    try {
        const { sessionId } = req.body;
        const user = req.user; // Retrieved from the mobile app's valid JWT

        if (!sessionId) {
            return res.status(400).json({ error: "Session ID is required" });
        }

        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const redisKey = `qr_session:${sessionId}`;
        const sessionDataString = await redisClient.get(redisKey);

        if (!sessionDataString) {
            // Expired or bad UUID
            return res.status(404).json({ error: "QR Code expired or invalid" });
        }

        const sessionData = JSON.parse(sessionDataString);

        if (sessionData.status !== 'pending') {
            return res.status(400).json({ error: "QR Code already used" });
        }

        // Generate a new JWT for the web session (same payload as mobile)
        const webToken = jwt.sign(
            {
                id: user.id || user.user_id, // Normalize based on your JWT payload
                user_id: user.id || user.user_id,
                role: user.role,
                organization_id: user.organization_id,
                project_id: user.project_id
            },
            process.env.JWT_SECRET || 'default_secret',
            { expiresIn: '30d' }
        );

        // Update Redis status (optional, but good for tracking/invalidation)
        await redisClient.set(redisKey, JSON.stringify({ status: 'authorized', token: webToken }), 'EX', 120);

        // Alert the waiting web client via Socket.io!
        const io = getIO();
        io.to(sessionId).emit('qr-authorized', { token: webToken, user });

        return res.status(200).json({ message: "Successfully authorized web session" });
    } catch (error) {
        console.error("Error authorizing QR session:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const getActiveQrSessions = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = user.id || user.user_id;

        // Find all qr_session keys
        const keys = await redisClient.keys('qr_session:*');

        if (!keys || keys.length === 0) {
            return res.status(200).json({ sessions: [] });
        }

        const sessions = [];

        // This loop is okay since Redis keys shouldn't be massive for a single instance,
        // but it's O(N) over all keys. For production scale we might map users to their session sets.
        for (const key of keys) {
            const dataString = await redisClient.get(key);
            if (dataString) {
                const sessionData = JSON.parse(dataString);
                // Check if it's an authorized session containing a token for THIS user
                if (sessionData.status === 'authorized' && sessionData.token) {
                    // Quick check if the embedded token belongs to the requesting user
                    try {
                        const decoded = jwt.decode(sessionData.token) as any;
                        if (decoded && (decoded.id === userId || decoded.user_id === userId)) {
                            // Valid session for this user
                            sessions.push({
                                sessionId: key.replace('qr_session:', ''),
                                // In a real app we'd capture device type/IP in the auth step and store it
                                device: "APEXISpro™ Web API Session"
                            });
                        }
                    } catch (e) {
                        // ignore malformed tokens
                    }
                }
            }
        }

        return res.status(200).json({ sessions });
    } catch (error) {
        console.error("Error fetching active sessions:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const revokeQrSession = async (req: AuthRequest, res: Response) => {
    try {
        const { sessionId } = req.params;
        const user = req.user;

        if (!user || !sessionId) {
            return res.status(400).json({ error: "Bad request" });
        }

        const redisKey = `qr_session:${sessionId}`;
        const dataString = await redisClient.get(redisKey);

        if (!dataString) {
            return res.status(404).json({ error: "Session not found or already expired" });
        }

        const sessionData = JSON.parse(dataString);

        // Ensure this user actually owns this session before deleting
        const userId = user.id || user.user_id;
        let isOwner = false;

        if (sessionData.token) {
            try {
                const decoded = jwt.decode(sessionData.token) as any;
                if (decoded && (decoded.id === userId || decoded.user_id === userId)) {
                    isOwner = true;
                }
            } catch (e) {
                // Ignore malformed
            }
        }

        if (!isOwner) {
            return res.status(403).json({ error: "Unauthorized to revoke this session" });
        }

        // Delete from Redis so the token can't be refreshed if we implement that, 
        //, and so it drops off the Linked Devices UI list
        await redisClient.del(redisKey);

        // Emit a web socket event to instantly log them out if the browser is currently open and listening
        const io = getIO();
        io.to(sessionId).emit('qr-revoked', { message: "Session terminated by mobile device" });

        return res.status(200).json({ message: "Session successfully revoked" });
    } catch (error) {
        console.error("Error revoking session:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};

export const revokeAllUserQrSessions = async (req: AuthRequest, res: Response) => {
    try {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const userId = user.id || user.user_id;

        // Find all qr_session keys
        const keys = await redisClient.keys('qr_session:*');
        const io = getIO();
        let revokedCount = 0;

        for (const key of keys) {
            const dataString = await redisClient.get(key);
            if (dataString) {
                const sessionData = JSON.parse(dataString);
                if (sessionData.token) {
                    try {
                        const decoded = jwt.decode(sessionData.token) as any;
                        if (decoded && (decoded.id === userId || decoded.user_id === userId)) {
                            // Match! Remove and notify
                            await redisClient.del(key);
                            const sessionId = key.replace('qr_session:', '');
                            io.to(sessionId).emit('qr-revoked', { message: "Global logout from mobile device" });
                            revokedCount++;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }
        }

        return res.status(200).json({ message: `Successfully revoked ${revokedCount} sessions` });
    } catch (error) {
        console.error("Error revoking all user sessions:", error);
        return res.status(500).json({ error: "Internal server error" });
    }
};
