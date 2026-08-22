import { Router } from 'express';
import { usersController } from './users.controller';
import { requireAuth } from '../auth/auth.middleware';
import { rateLimitStandard } from '../../shared/rateLimiter';

const router = Router();

router.use(requireAuth);

router.get('/search', rateLimitStandard, (req, res, next) => usersController.searchUsers(req as any, res, next));
router.patch('/me', (req, res, next) => usersController.updateProfile(req as any, res, next));
router.get('/:id', (req, res, next) => usersController.getUserById(req as any, res, next));

export const usersRoutes = router;
