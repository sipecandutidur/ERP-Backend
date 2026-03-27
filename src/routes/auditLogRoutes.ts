import { Router } from 'express';
import { getAuditLogs } from '../controllers/auditLogController';

const router: Router = Router();

router.get('/', getAuditLogs);

export default router;
