import { Router } from 'express';
import {
    listRooms,
    getRoomMessages,
    sendChatMessage,
    uploadChatFile,
    markMessageSeen,
    createRoom,
    markRoomRead,
    downloadFileProxy,
    getChatProjects,
    updateRoom,
    addRoomMembers,
    removeRoomMember,
    deleteRoom,
    updateChatMessage,
    deleteChatMessage
} from '../controllers/chatController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const router = Router();

router.get('/', verifyToken, listRooms);
router.post('/create', verifyToken, createRoom);
router.get('/:roomId/messages', verifyToken, getRoomMessages);
router.get('/:roomId/projects', verifyToken, getChatProjects);
router.post('/send', verifyToken, sendChatMessage);
router.post('/upload', verifyToken, upload.single('file'), uploadChatFile);
router.patch('/seen', verifyToken, markMessageSeen);
router.patch('/:roomId/read', verifyToken, markRoomRead);
router.get('/download/:messageId', verifyToken, downloadFileProxy);

router.patch('/:roomId', verifyToken, updateRoom);
router.post('/:roomId/members', verifyToken, addRoomMembers);
router.delete('/:roomId/members/:userId', verifyToken, removeRoomMember);
router.delete('/:roomId', verifyToken, deleteRoom);
router.patch('/message/:messageId', verifyToken, updateChatMessage);
router.delete('/message/:messageId', verifyToken, deleteChatMessage);

export default router;
