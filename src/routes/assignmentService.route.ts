import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { CalculateAssignmentQuoteSchema } from '../schemas/assignment.schema';
import { memoryUpload } from '../middlewares/upload';
import { s3Service } from '../services/s3.service';

const router = Router();

// Calculate quote for handwritten assignment writer
router.post('/calculate-quote', validate(CalculateAssignmentQuoteSchema), (req: Request, res: Response) => {
  const { num_pages, paper_type, binding_type, ink_color, is_urgent } = req.body;

  let ratePerPage = 15.0; // Base ₹15/page
  if (paper_type === 'practical_sheet') {
    ratePerPage = 20.0;
  }

  let bindingCost = 0.0;
  if (binding_type === 'spiral') bindingCost = 35.0;
  if (binding_type === 'channel_file') bindingCost = 20.0;

  let writingSubtotal = +(num_pages * ratePerPage).toFixed(2);
  if (is_urgent) {
    writingSubtotal = +(writingSubtotal * 1.3).toFixed(2); // 30% urgency charge
  }

  const estimatedTotal = +(writingSubtotal + bindingCost).toFixed(2);

  res.status(200).json({
    success: true,
    data: {
      num_pages,
      rate_per_page: ratePerPage,
      writing_subtotal: writingSubtotal,
      binding_cost: bindingCost,
      estimated_total: estimatedTotal,
    },
  });
});

// Upload reference document / assignment prompt
router.post(
  '/upload-file',
  authenticate,
  memoryUpload.single('file'),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, detail: 'No file uploaded' });
        return;
      }

      const fileUrl = await s3Service.uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype);

      res.status(200).json({
        success: true,
        message: 'Assignment file uploaded successfully',
        data: {
          file_url: fileUrl,
          file_name: req.file.originalname,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
