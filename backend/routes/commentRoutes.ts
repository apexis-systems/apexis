import { Router } from 'express';
import { getComments, addComment, deleteComment } from '../controllers/commentController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();
router.use(verifyToken);

router.get('/', getComments);
router.post('/', addComment);
router.delete('/:id', deleteComment);

export default router;
