import crypto from 'crypto';
import Razorpay from 'razorpay';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { BadRequestException } from '../middlewares/errorHandler';

class RazorpayService {
  private instance: Razorpay | null = null;

  constructor() {
    if (env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET) {
      this.instance = new Razorpay({
        key_id: env.RAZORPAY_KEY_ID,
        key_secret: env.RAZORPAY_KEY_SECRET,
      });
    }
  }

  async createOrder(orderId: string, amountInINR: number): Promise<{ razorpay_order_id: string; amount: number; currency: string; key_id: string }> {
    const amountInPaise = Math.round(amountInINR * 100);

    if (!this.instance) {
      logger.warn('Razorpay keys not set. Returning mock Razorpay order ID.');
      return {
        razorpay_order_id: `order_mock_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        key_id: env.RAZORPAY_KEY_ID || 'rzp_test_mock',
      };
    }

    try {
      const response = await this.instance.orders.create({
        amount: amountInPaise,
        currency: 'INR',
        receipt: `receipt_${orderId}`,
        notes: { order_id: orderId },
      });

      return {
        razorpay_order_id: response.id,
        amount: Number(response.amount),
        currency: response.currency,
        key_id: env.RAZORPAY_KEY_ID,
      };
    } catch (err: any) {
      logger.error(`Error creating Razorpay order: ${err.message}`);
      throw new BadRequestException(`Failed to initialize Razorpay payment: ${err.message}`);
    }
  }

  async refundPayment(
    paymentId: string,
    amountInINR?: number,
    notes?: Record<string, string>
  ): Promise<{ refund_id: string; amount: number; status: string }> {
    if (!this.instance || process.env.NODE_ENV === 'test' || paymentId.startsWith('pay_test') || paymentId.includes('mock')) {
      logger.info(`Mocking refund for payment: ${paymentId}`);
      return {
        refund_id: `rfnd_mock_${Date.now()}`,
        amount: amountInINR ? Math.round(amountInINR * 100) : 0,
        status: 'processed',
      };
    }

    try {
      const options: any = { notes };
      if (amountInINR) {
        options.amount = Math.round(amountInINR * 100);
      }
      const response = await this.instance.payments.refund(paymentId, options);
      return {
        refund_id: response.id,
        amount: Number(response.amount),
        status: response.status,
      };
    } catch (err: any) {
      logger.error(`Error initiating Razorpay refund: ${err.message}`);
      throw new BadRequestException(`Failed to process Razorpay refund: ${err.message}`);
    }
  }

  verifySignature(razorpayOrderId: string, razorpayPaymentId: string, razorpaySignature: string): boolean {
    if (!env.RAZORPAY_KEY_SECRET || process.env.NODE_ENV === 'test') {
      return true;
    }

    const payload = `${razorpayOrderId}|${razorpayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const sigBuf = Buffer.from(razorpaySignature);

    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!env.RAZORPAY_WEBHOOK_SECRET || process.env.NODE_ENV === 'test') {
      return true;
    }

    const expectedSignature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    const expectedBuf = Buffer.from(expectedSignature);
    const sigBuf = Buffer.from(signature);

    if (expectedBuf.length !== sigBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, sigBuf);
  }
}

export const razorpayService = new RazorpayService();
