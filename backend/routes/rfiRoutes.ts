import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { getRFIs, createRFI, updateRFIStatus, getRFIById, getRFIAssignees } from '../controllers/rfiController.ts';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(verifyToken);

router.get('/', getRFIs);
router.get('/assignees', getRFIAssignees);
router.get('/:id', getRFIById);
router.post('/', upload.array('photos', 5), createRFI);
router.patch('/:id/status', updateRFIStatus);

export default router;
