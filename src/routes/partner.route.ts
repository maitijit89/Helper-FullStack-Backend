import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthenticatedRequest, requirePartnerApproved, requireActiveGPS } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { PartnerRegistrationSchema, PartnerLocationUpdateSchema, PartnerStatusToggleSchema } from '../schemas/partner.schema';
import { User, UserRole, PartnerVerificationStatus } from '../models/User';
import { Order, OrderStatus } from '../models/Order';
import { dispatchEngine } from '../services/dispatch.service';
import { walletService } from '../services/wallet.service';
import { googleSheetsService } from '../services/googleSheets.service';
import { memoryUpload } from '../middlewares/upload';
import { s3Service } from '../services/s3.service';
import { BadRequestException, NotFoundException } from '../middlewares/errorHandler';

const router = Router();

// Partner onboarding / profile submission
router.post('/register', authenticate, validate(PartnerRegistrationSchema), async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const user = req.user!;
    user.role = UserRole.PARTNER;
    user.partner_profile = {
      ...req.body,
      verification_status: PartnerVerificationStatus.PENDING,
      is_online: false,
    };
    user.touch();
    await user.save();

    await walletService.getOrCreateWallet(user._id.toString());

    // Sync to Google Sheets
    await googleSheetsService.exportPartnerApplication({
      user_id: user._id.toString(),
      email: user.email,
      full_name: user.full_name,
      phone: user.phone,
      vehicle_type: user.partner_profile?.vehicle_type,
      vehicle_number: user.partner_profile?.vehicle_number,
      status: PartnerVerificationStatus.PENDING,
      created_at: new Date(),
    });

    res.status(200).json({
      success: true,
      message: 'Partner application submitted successfully. Pending admin approval.',
      data: user,
    });
  } catch (err) {
    next(err);
  }
});

// Partner document upload (Driving license, Aadhaar)
router.post(
  '/upload-documents',
  authenticate,
  memoryUpload.fields([
    { name: 'driving_license', maxCount: 1 },
    { name: 'aadhaar', maxCount: 1 },
  ]),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };

      if (!user.partner_profile) {
        user.partner_profile = {
          verification_status: PartnerVerificationStatus.PENDING,
          is_online: false,
        };
      }

      if (files?.driving_license?.[0]) {
        const dlFile = files.driving_license[0];
        const dlUrl = await s3Service.uploadFile(dlFile.buffer, dlFile.originalname, dlFile.mimetype);
        user.partner_profile.driving_license_url = dlUrl;
      }

      if (files?.aadhaar?.[0]) {
        const aadhaarFile = files.aadhaar[0];
        const aadhaarUrl = await s3Service.uploadFile(aadhaarFile.buffer, aadhaarFile.originalname, aadhaarFile.mimetype);
        user.partner_profile.aadhaar_url = aadhaarUrl;
      }

      user.touch();
      await user.save();

      res.status(200).json({
        success: true,
        message: 'Documents uploaded successfully',
        data: user.partner_profile,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Update live GPS location & online status
router.post(
  '/location',
  authenticate,
  requirePartnerApproved,
  validate(PartnerLocationUpdateSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      const { latitude, longitude, accuracy, address, is_online } = req.body;

      user.location = { latitude, longitude, accuracy, address, timestamp: new Date() };
      user.is_gps_enabled = true;
      if (is_online !== undefined && user.partner_profile) {
        user.partner_profile.is_online = is_online;
      }

      user.touch();
      await user.save();

      res.status(200).json({
        success: true,
        data: {
          location: user.location,
          is_online: user.partner_profile?.is_online,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// Toggle online / offline status
router.post(
  '/status/toggle',
  authenticate,
  requirePartnerApproved,
  validate(PartnerStatusToggleSchema),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user!;
      if (user.partner_profile) {
        user.partner_profile.is_online = req.body.is_online;
      }
      user.touch();
      await user.save();

      res.status(200).json({
        success: true,
        message: `Partner is now ${req.body.is_online ? 'online' : 'offline'}`,
        is_online: user.partner_profile?.is_online,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get available ringing orders for this delivery partner
router.get(
  '/orders/available',
  authenticate,
  requirePartnerApproved,
  requireActiveGPS,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partnerId = req.user!._id.toString();
      const orders = await Order.find({
        status: OrderStatus.PENDING,
        notified_partner_ids: partnerId,
      }).sort({ created_at: -1 });

      res.status(200).json({
        success: true,
        data: orders,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Get currently active accepted order assigned to this partner
router.get(
  '/orders/active',
  authenticate,
  requirePartnerApproved,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partnerId = req.user!._id.toString();
      const activeOrder = await Order.findOne({
        partner_id: partnerId,
        status: { $in: [OrderStatus.ASSIGNED, OrderStatus.DOCUMENT_PICKED_UP, OrderStatus.OUT_FOR_DELIVERY] },
      });

      res.status(200).json({
        success: true,
        data: activeOrder || null,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Accept an order
router.post(
  '/orders/:order_id/accept',
  authenticate,
  requirePartnerApproved,
  requireActiveGPS,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partnerId = req.user!._id.toString();
      const order = await dispatchEngine.acceptOrder(req.params.order_id, partnerId);

      if (!order) {
        throw new BadRequestException('Order is no longer available or has already been accepted by another partner.');
      }

      res.status(200).json({
        success: true,
        message: 'Order accepted successfully',
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }
);

// Update delivery progress / status
router.patch(
  '/orders/:order_id/status',
  authenticate,
  requirePartnerApproved,
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const partnerId = req.user!._id.toString();
      const { status } = req.body;

      if (!Object.values(OrderStatus).includes(status)) {
        throw new BadRequestException(`Invalid order status: ${status}`);
      }

      const order = await Order.findOne({ order_id: req.params.order_id, partner_id: partnerId });
      if (!order) {
        throw new NotFoundException('Order not found or not assigned to you');
      }

      order.status = status;
      order.touch();

      if (status === OrderStatus.DELIVERED) {
        // Credit partner earnings
        await walletService.creditOrderEarnings(partnerId, order.order_id, order.delivery_fee);
      }

      await order.save();

      res.status(200).json({
        success: true,
        message: `Order status updated to ${status}`,
        data: order,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
