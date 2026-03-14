import { Router } from 'express';
import { listRooms, getRoomMessages, sendChatMessage, markMessageSeen, createRoom, markRoomRead } from '../controllers/chatController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();

router.get('/', verifyToken, listRooms);
router.post('/create', verifyToken, createRoom);
router.get('/:roomId/messages', verifyToken, getRoomMessages);
router.post('/send', verifyToken, sendChatMessage);
router.patch('/seen', verifyToken, markMessageSeen);
router.patch('/:roomId/read', verifyToken, markRoomRead);

export default router;
