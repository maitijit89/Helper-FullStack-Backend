import { z } from 'zod';

export const versionCheckQuerySchema = z.object({
  platform: z.enum(
    [
      'user_app',
      'partner_portal',
      'admin_panel',
      'user_analysis_engine',
      'product_listing_bff',
    ],
    {
      required_error: 'Query parameter "platform" is required',
      invalid_type_error:
        'Platform must be one of: user_app, partner_portal, admin_panel, user_analysis_engine, product_listing_bff',
    }
  ),
  version: z
    .string({ required_error: 'Query parameter "version" is required' })
    .trim()
    .regex(
      /^v?\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/,
      'Version must follow semantic versioning format (e.g. 1.2.1 or v1.2.1)'
    ),
});

export type VersionCheckQueryParams = z.infer<typeof versionCheckQuerySchema>;

