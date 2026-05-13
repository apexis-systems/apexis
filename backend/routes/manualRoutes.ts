import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { getManuals, uploadManual, deleteManual } from '../controllers/manualController.ts';
import { checkLimit } from '../middleware/checkLimit.ts';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.use(verifyToken);

router.get('/', getManuals);
router.post('/', upload.single('file'), checkLimit('storage'), uploadManual);
router.delete('/:id', deleteManual);

export default router;
