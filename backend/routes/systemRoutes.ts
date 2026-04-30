import { Router } from 'express';
import { getSystemConfig } from '../controllers/systemController.ts';

const router = Router();

router.get('/config', getSystemConfig);

export default router;
