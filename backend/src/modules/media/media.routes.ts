import { Router } from 'express';
import { mediaController, upload } from './media.controller';
import { requireAuth } from '../auth/auth.middleware';

const router = Router();

router.use(requireAuth);

router.post('/upload', upload.single('file'), (req, res, next) => mediaController.uploadFile(req as any, res, next));
router.post('/upload-url', (req, res, next) => mediaController.getUploadUrl(req as any, res, next));

export const mediaRoutes = router;
