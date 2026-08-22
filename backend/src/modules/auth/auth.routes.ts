import { Router } from 'express';
import { authController } from './auth.controller';
import { requireAuth } from './auth.middleware';
import { rateLimitAuth } from '../../shared/rateLimiter';

const router = Router();

router.post('/register', rateLimitAuth, (req, res, next) => authController.register(req, res, next));
router.post('/login', rateLimitAuth, (req, res, next) => authController.login(req, res, next));
router.post('/refresh', (req, res, next) => authController.refresh(req, res, next));
router.post('/logout', (req, res, next) => authController.logout(req, res, next));
router.get('/me', requireAuth, (req, res, next) => authController.getMe(req, res, next));

export const authRoutes = router;
