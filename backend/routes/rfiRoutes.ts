import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { checkLimit } from '../middleware/checkLimit.ts';
import { getRFIs, createRFI, updateRFIStatus, getRFIById, getRFIAssignees, updateRFIResponse, deleteRFI, updateRFI } from '../controllers/rfiController.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

router.get('/', getRFIs);
router.get('/assignees', getRFIAssignees);
router.get('/:id', getRFIById);
router.post('/', upload.array('photos', 3), checkLimit('rfi'), createRFI);
router.patch('/:id/status', updateRFIStatus);
router.patch('/:id/response', upload.array('photos', 3), updateRFIResponse);
router.patch('/:id', upload.array('photos', 3), updateRFI);
router.delete('/:id', deleteRFI);

export default router;
