import { Router } from 'express';
import { conversationsController } from './conversations.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', (req, res, next) => conversationsController.listConversations(req as any, res, next));
router.post('/', (req, res, next) => conversationsController.getOrCreateConversation(req as any, res, next));
router.patch('/:id', (req, res, next) => conversationsController.updateConversation(req as any, res, next));

export const conversationsRoutes = router;
