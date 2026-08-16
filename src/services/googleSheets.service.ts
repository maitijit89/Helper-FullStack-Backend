import axios from 'axios';
import { google } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../config/logger';

class GoogleSheetsService {
  /**
   * Appends partner application data to Google Sheets via Webhook or Google Sheets API.
   */
  async exportPartnerApplication(data: {
    user_id: string;
    email: string;
    full_name?: string;
    phone?: string;
    vehicle_type?: string;
    vehicle_number?: string;
    status: string;
    created_at: Date;
  }): Promise<boolean> {
    // 1. If Google Sheet Webhook URL is configured
    if (env.GOOGLE_SHEET_WEBHOOK_URL) {
      try {
        await axios.post(env.GOOGLE_SHEET_WEBHOOK_URL, data, { timeout: 5000 });
        logger.info(`Exported partner application to Google Sheet webhook: ${data.email}`);
        return true;
      } catch (err: any) {
        logger.warn(`Google Sheet webhook export failed: ${err.message}`);
      }
    }

    // 2. Direct Google Sheets API with service account credentials if configured
    if (env.GOOGLE_SHEETS_SPREADSHEET_ID && (env.GOOGLE_SERVICE_ACCOUNT_INFO || env.GOOGLE_SERVICE_ACCOUNT_FILE)) {
      try {
        let auth;
        if (env.GOOGLE_SERVICE_ACCOUNT_INFO) {
          const credentials = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_INFO);
          auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
        } else {
          auth = new google.auth.GoogleAuth({
            keyFile: env.GOOGLE_SERVICE_ACCOUNT_FILE,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
        }

        const sheets = google.sheets({ version: 'v4', auth });
        await sheets.spreadsheets.values.append({
          spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
          range: `${env.GOOGLE_SHEETS_SHEET_NAME}!A:H`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [
              [
                data.user_id,
                data.email,
                data.full_name || '',
                data.phone || '',
                data.vehicle_type || '',
                data.vehicle_number || '',
                data.status,
                data.created_at.toISOString(),
              ],
            ],
          },
        });
        logger.info(`Exported partner application via Sheets API: ${data.email}`);
        return true;
      } catch (err: any) {
        logger.warn(`Google Sheets API sync failed: ${err.message}`);
      }
    }

    return false;
  }
}

export const googleSheetsService = new GoogleSheetsService();
