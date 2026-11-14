import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { r2Service } from '../services/r2.service';
import { authenticate } from '../middlewares/auth';
import { presignedUrlSchema } from '../schemas/upload.schema';

const router = Router();

// Require authentication for generating upload URLs
router.use(authenticate);

/**
 * @route   POST /api/v1/uploads/presigned-url
 * @desc    Generate a presigned S3/R2 upload URL for direct client-to-storage uploads
 */
router.post('/presigned-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = presignedUrlSchema.parse(req.body);
    const sanitizedName = validated.fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${validated.folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${sanitizedName}`;

    if (r2Service.isConfigured) {
      const result = await r2Service.getPresignedUploadUrl(key, validated.contentType);
      return res.status(200).json({
        success: true,
        message: 'Presigned upload URL generated successfully.',
        data: {
          uploadUrl: result.uploadUrl,
          key: result.key,
          publicUrl: result.publicUrl,
          provider: r2Service.provider,
          expiresIn: 3600,
        },
      });
    }

    // Mock fallback when storage is unconfigured
    const mockUrl = `https://mock-storage.helpingservices.local/${key}`;
    return res.status(200).json({
      success: true,
      message: 'Presigned upload URL simulated (storage unconfigured).',
      data: {
        uploadUrl: `${mockUrl}?signature=mock_upload_sig`,
        key,
        publicUrl: mockUrl,
        provider: 'mock-storage',
        expiresIn: 3600,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
