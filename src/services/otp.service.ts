import { OTP, OTPPurpose } from '../models/OTP';
import { emailService } from './email.service';
import { BadRequestException } from '../middlewares/errorHandler';

class OTPService {
  generateCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  async sendOTP(email: string, purpose: OTPPurpose = OTPPurpose.LOGIN): Promise<{ success: boolean; message: string; code: string }> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    // Invalidate prior unused OTPs for this email and purpose
    await OTP.updateMany(
      { email: email.toLowerCase().trim(), purpose, is_used: false },
      { $set: { is_used: true } }
    );

    const otpDoc = new OTP({
      email: email.toLowerCase().trim(),
      code,
      purpose,
      expires_at: expiresAt,
      is_used: false,
    });
    await otpDoc.save();

    // Send email
    await emailService.sendOTPEmail(email.toLowerCase().trim(), code, purpose);

    return {
      success: true,
      message: `OTP sent successfully to ${email}`,
      code,
    };
  }

  async verifyOTP(email: string, code: string, purpose: OTPPurpose = OTPPurpose.LOGIN): Promise<boolean> {
    const cleanEmail = email.toLowerCase().trim();
    const cleanCode = code.trim();

    // Match exact purpose or allow LOGIN and REGISTRATION interchangeably
    const purposeFilter =
      purpose === OTPPurpose.LOGIN || purpose === OTPPurpose.REGISTRATION
        ? { $in: [OTPPurpose.LOGIN, OTPPurpose.REGISTRATION] }
        : purpose;

    const otpDoc = await OTP.findOne({
      email: cleanEmail,
      code: cleanCode,
      purpose: purposeFilter,
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
