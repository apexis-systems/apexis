import { Router } from 'express';
import { listNotifications, markAsRead, markAllRead } from '../controllers/notificationController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();

router.get('/', verifyToken, listNotifications);
router.patch('/read-all', verifyToken, markAllRead);   // ← must be before /:id/read
router.patch('/:id/read', verifyToken, markAsRead);

export default router;
