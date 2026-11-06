import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CalculatePrintPriceSchema } from '../schemas/print.schema';
import { printPricingEngine } from '../services/printPricing.service';
import { pageCounterService } from '../services/pageCounter.service';
import { s3Service } from '../services/s3.service';
import { memoryUpload } from '../middlewares/upload';

const router = Router();

// Calculate print cost breakdown
router.post('/calculate-price', validate(CalculatePrintPriceSchema), (req: Request, res: Response) => {
  const breakdown = printPricingEngine.calculatePrice(req.body);
  res.status(200).json({
    success: true,
    data: breakdown,
  });
});

// Upload document with automated PDF page inspection
router.post(
  '/upload-document',
  authenticate,
  memoryUpload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, detail: 'No file uploaded' });
        return;
      }

      const fileBuffer = req.file.buffer;
      const originalName = req.file.originalname;
      const mimeType = req.file.mimetype;

      let numPages = 1;
      if (mimeType === 'application/pdf' || originalName.toLowerCase().endsWith('.pdf')) {
        const pageResult = await pageCounterService.countPdfPages(fileBuffer);
        numPages = pageResult.num_pages;
      }

      const fileUrl = await s3Service.uploadFile(fileBuffer, originalName, mimeType);

      res.status(200).json({
        success: true,
        message: 'Document uploaded successfully',
        data: {
          file_url: fileUrl,
          document_name: originalName,
          num_pages: numPages,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
