import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { checkLimit } from '../middleware/checkLimit.ts';
import { getSnags, createSnag, updateSnagStatus, deleteSnag, getAssignees, updateSnag, markSnagSeen, getFolderSnags } from '../controllers/snagController.ts';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.use(verifyToken);

router.get('/assignees', getAssignees);
router.get('/folder/:folder_id', getFolderSnags);
router.get('/', getSnags);
router.post('/', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), checkLimit('snag'), createSnag);
router.patch('/:id/status', upload.array('photos', 2), updateSnagStatus);
router.patch('/:id/seen', markSnagSeen);
router.patch('/:id', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'audio', maxCount: 1 }]), updateSnag);
router.delete('/:id', deleteSnag);

export default router;
