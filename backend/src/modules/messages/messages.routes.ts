import { Router } from 'express';
import { messagesController } from './messages.controller';
import { requireAuth } from '../auth/auth.middleware';
import { rateLimitStandard } from '../../shared/rateLimiter';

const router = Router();

router.use(requireAuth);

router.get('/conversations/:id/messages', (req, res, next) => messagesController.getMessages(req as any, res, next));
router.post('/conversations/:id/messages', rateLimitStandard, (req, res, next) => messagesController.sendMessage(req as any, res, next));
router.patch('/messages/:id', (req, res, next) => messagesController.editMessage(req as any, res, next));
router.delete('/messages/:id', (req, res, next) => messagesController.deleteMessage(req as any, res, next));
router.post('/messages/:id/reactions', (req, res, next) => messagesController.toggleReaction(req as any, res, next));

export const messagesRoutes = router;
