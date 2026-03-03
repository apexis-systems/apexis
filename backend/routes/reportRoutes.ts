import { Router } from 'express';
import { getReports, getReportById, triggerReport } from '../controllers/reportController.ts';
import { verifyToken } from '../middleware/verifyToken.ts';

const router = Router();
router.use(verifyToken);

router.get('/', getReports);
router.get('/generate-now', triggerReport);   // manual trigger for testing
router.get('/:id', getReportById);

export default router;
