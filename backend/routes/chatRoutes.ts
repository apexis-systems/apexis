import { Router } from 'express';
import { listRooms, getRoomMessages, sendChatMessage, markMessageSeen, createRoom } from '../controllers/chatController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();

router.get('/', verifyToken, listRooms);
router.post('/create', verifyToken, createRoom);
router.get('/:roomId/messages', verifyToken, getRoomMessages);
router.post('/send', verifyToken, sendChatMessage);
router.patch('/seen', verifyToken, markMessageSeen);

export default router;
