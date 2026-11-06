import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middlewares/auth';
import { uploadSingle } from '../middlewares/upload';
import { r2Service } from '../services/r2.service';
import { BadRequestException } from '../middlewares/errorHandler';

const router = Router();

// Upload a single file to Cloudflare R2
router.post('/upload', authenticate, uploadSingle('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestException('No file provided in request payload (field "file" required)');
    }

    const folder = (req.body.folder as string) || 'uploads';
    const fileUrl = await r2Service.uploadFile(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        url: fileUrl,
        filename: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype,
        storage: r2Service.provider,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Generate presigned download URL
router.get('/presigned-url', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const key = req.query.key as string;
    if (!key) {
      throw new BadRequestException('Query parameter "key" is required');
    }
    const expiresIn = parseInt((req.query.expiresIn as string) || '3600', 10);
    const presignedUrl = await r2Service.getPresignedUrl(key, expiresIn);

    res.status(200).json({
      success: true,
      data: {
        key,
        url: presignedUrl,
        expiresInSeconds: expiresIn,
        storage: r2Service.provider,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
