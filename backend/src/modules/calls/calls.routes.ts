import { Router } from 'express';
import { requireAuth } from '../auth/auth.middleware';
import { callsController } from './calls.controller';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => callsController.getCallHistory(req as any, res, next));

export default router;
