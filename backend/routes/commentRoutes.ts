import { Router } from 'express';
import { getComments, addComment, deleteComment, updateComment } from '../controllers/commentController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();
router.use(verifyToken);

router.get('/', getComments);
router.post('/', addComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);

export default router;
