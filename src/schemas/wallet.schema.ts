import { z } from 'zod';
import { PayoutMethod } from '../models/WithdrawalRequest';

export const CreateWithdrawalRequestSchema = z.object({
  body: z.object({
    amount: z.number().min(1),
    payout_method: z.nativeEnum(PayoutMethod),
    upi_id: z.string().optional(),
    bank_account_number: z.string().optional(),
    ifsc_code: z.string().optional(),
    account_holder_name: z.string().optional(),
  }),
});
