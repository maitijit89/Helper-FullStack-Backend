import { OTP, OTPPurpose } from '../models/OTP';
import { emailService } from './email.service';
import { BadRequestException } from '../middlewares/errorHandler';

class OTPService {
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string, purpose: OTPPurpose = OTPPurpose.REGISTRATION): Promise<{ success: boolean; message: string }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Invalidate prior unused OTPs for this email and purpose
    await OTP.updateMany(
      { email: email.toLowerCase(), purpose, is_used: false },
      { $set: { is_used: true } }
    );

    const otpDoc = new OTP({
      email: email.toLowerCase(),
      code,
      purpose,
      expires_at: expiresAt,
      is_used: false,
    });
    await otpDoc.save();

    // Send email
    await emailService.sendOTPEmail(email, code, purpose);

    return {
      success: true,
      message: `OTP sent successfully to ${email}`,
    };
  }

  async verifyOTP(email: string, code: string, purpose: OTPPurpose = OTPPurpose.REGISTRATION): Promise<boolean> {
    const otpDoc = await OTP.findOne({
      email: email.toLowerCase(),
      code,
      purpose,
      is_used: false,
    }).sort({ created_at: -1 });

    if (!otpDoc) {
      throw new BadRequestException('Invalid verification code');
    }

    if (new Date() > otpDoc.expires_at) {
      otpDoc.is_used = true;
      await otpDoc.save();
      throw new BadRequestException('Verification code has expired');
    }

    otpDoc.is_used = true;
    await otpDoc.save();
    return true;
  }
}

export const otpService = new OTPService();
