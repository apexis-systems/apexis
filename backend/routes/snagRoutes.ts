import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { checkLimit } from '../middleware/checkLimit.ts';
import { getSnags, createSnag, updateSnagStatus, deleteSnag, getAssignees, updateSnag } from '../controllers/snagController.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

router.get('/assignees', getAssignees);
router.get('/', getSnags);
router.post('/', upload.single('photo'), checkLimit('snag'), createSnag);
router.patch('/:id/status', upload.array('photos', 3), updateSnagStatus);
router.patch('/:id', upload.single('photo'), updateSnag);
router.delete('/:id', deleteSnag);

export default router;
