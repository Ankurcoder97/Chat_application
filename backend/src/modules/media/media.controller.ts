import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';
import { BadRequestError } from '../../shared/errors';
import { AuthRequest } from '../auth/auth.middleware';

const uploadDir = path.resolve(process.cwd(), config.UPLOAD_DIR);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = `${uuidv4()}${ext}`;
    cb(null, uniqueName);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Allow images, audio, video, documents
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'audio/mpeg',
      'audio/ogg',
      'audio/wav',
      'audio/webm',
      'video/mp4',
      'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];

    if (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/') || file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new BadRequestError('Unsupported file format'));
    }
  },
});

export class MediaController {
  public async uploadFile(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('No file uploaded');
      }

      const file = req.file;
      const fileUrl = `/uploads/${file.filename}`;

      let mediaType: 'image' | 'video' | 'audio' | 'document' | 'voice' = 'document';
      if (file.mimetype.startsWith('image/')) mediaType = 'image';
      else if (file.mimetype.startsWith('video/')) mediaType = 'video';
      else if (file.mimetype.startsWith('audio/')) mediaType = 'audio';

      res.status(201).json({
        success: true,
        data: {
          url: fileUrl,
          mimeType: file.mimetype,
          size: file.size,
          filename: file.originalname,
          type: mediaType,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  public async getUploadUrl(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { type, mimeType, size, filename } = req.body;
      const mediaId = uuidv4();
      const ext = filename ? path.extname(filename) : '.bin';
      const key = `nexus/${req.user?.userId}/${mediaId}${ext}`;

      // Returns simulated direct upload url or local endpoint
      res.status(200).json({
        success: true,
        data: {
          uploadUrl: `/api/v1/media/upload`,
          publicId: key,
          mediaId,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const mediaController = new MediaController();
