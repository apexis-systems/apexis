import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/verifyToken.ts';
import { checkLimit } from '../middleware/checkLimit.ts';
import { getRFIs, createRFI, updateRFIStatus, getRFIById, getRFIAssignees, updateRFIResponse, deleteRFI, updateRFI, getFolderRFIs, markRFISeen } from '../controllers/rfiController.ts';
import { createConversationMessage, getConversationMessages } from '../controllers/conversationMessageController.ts';

const router = Router();
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB
});

router.use(verifyToken);

router.get('/', getRFIs);
router.get('/assignees', getRFIAssignees);
router.get('/:id/messages', (req, res) => getConversationMessages({ ...req, params: { ...req.params, itemType: 'rfi' } } as any, res));
router.get('/:id', getRFIById);
router.get('/folder/:folder_id', getFolderRFIs);
router.post('/', upload.array('photos', 5), checkLimit('rfi'), createRFI);
router.post('/:id/messages', upload.single('file'), (req, res) => createConversationMessage({ ...req, params: { ...req.params, itemType: 'rfi' } } as any, res));
router.patch('/:id/status', updateRFIStatus);
router.patch('/:id/response', upload.array('photos', 2), updateRFIResponse);
router.patch('/:id/seen', markRFISeen);
router.patch('/:id', upload.array('photos', 5), updateRFI);
router.delete('/:id', deleteRFI);

export default router;
