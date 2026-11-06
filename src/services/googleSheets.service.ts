import axios from 'axios';
import path from 'path';
import { google } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface PartnerSheetData {
  user_id: string;
  email: string;
  full_name?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  status: string;
  pan_card_url?: string;
  aadhaar_url?: string;
  created_at: Date;
}

const SHEET_HEADERS = [
  'User ID',
  'Email',
  'Full Name',
  'Phone',
  'Vehicle Type',
  'Vehicle Number',
  'Status',
  'PAN Card Photo',
  'Aadhaar Card Photo',
  'Submitted At',
];

class GoogleSheetsService {
  /**
   * Upserts partner application data (including PAN card & Aadhaar card photos)
   * to Google Sheets via Webhook or Google Sheets API.
   */
  async exportPartnerApplication(data: PartnerSheetData): Promise<boolean> {
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
          const keyPath = path.isAbsolute(env.GOOGLE_SERVICE_ACCOUNT_FILE)
            ? env.GOOGLE_SERVICE_ACCOUNT_FILE
            : path.resolve(process.cwd(), env.GOOGLE_SERVICE_ACCOUNT_FILE);

          auth = new google.auth.GoogleAuth({
            keyFile: keyPath,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
          });
        }

        const sheets = google.sheets({ version: 'v4', auth });
        const sheetName = env.GOOGLE_SHEETS_SHEET_NAME;

        // Fetch Column A to identify header and existing partner row
        const colAResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
          range: `${sheetName}!A:A`,
        });
        const colAValues = colAResponse.data.values || [];

        // Check if header needs to be written or updated
        if (colAValues.length === 0 || colAValues[0]?.[0] !== SHEET_HEADERS[0]) {
          await sheets.spreadsheets.values.update({
            spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: `${sheetName}!A1:J1`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [SHEET_HEADERS] },
          });
        }

        // Check if this partner already exists in the sheet
        const existingRowIndex = colAValues.findIndex((row) => row && row[0] === data.user_id);

        let panCardUrl = data.pan_card_url || '';
        let aadhaarUrl = data.aadhaar_url || '';

        if (existingRowIndex !== -1) {
          const rowNum = existingRowIndex + 1;
          // If URLs weren't provided in the current call, preserve existing row values
          if (!panCardUrl || !aadhaarUrl) {
            try {
              const rowRes = await sheets.spreadsheets.values.get({
                spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
                range: `${sheetName}!H${rowNum}:I${rowNum}`,
              });
              const existingDocs = rowRes.data.values?.[0];
              if (!panCardUrl && existingDocs?.[0]) panCardUrl = existingDocs[0];
              if (!aadhaarUrl && existingDocs?.[1]) aadhaarUrl = existingDocs[1];
            } catch {
              // ignore and proceed
            }
          }

          const rowValues = [
            data.user_id,
            data.email,
            data.full_name || '',
            data.phone || '',
            data.vehicle_type || '',
            data.vehicle_number || '',
            data.status,
            panCardUrl,
            aadhaarUrl,
            data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
          ];

          await sheets.spreadsheets.values.update({
            spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: `${sheetName}!A${rowNum}:J${rowNum}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] },
          });
          logger.info(`Updated partner application in Google Sheets (Row ${rowNum}): ${data.email}`);
        } else {
          const rowValues = [
            data.user_id,
            data.email,
            data.full_name || '',
            data.phone || '',
            data.vehicle_type || '',
            data.vehicle_number || '',
            data.status,
            panCardUrl,
            aadhaarUrl,
            data.created_at ? new Date(data.created_at).toISOString() : new Date().toISOString(),
          ];

          await sheets.spreadsheets.values.append({
            spreadsheetId: env.GOOGLE_SHEETS_SPREADSHEET_ID,
            range: `${sheetName}!A:J`,
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [rowValues] },
          });
          logger.info(`Appended new partner application with documents to Google Sheets: ${data.email}`);
        }

        return true;
      } catch (err: any) {
        logger.warn(`Google Sheets API sync failed: ${err.message}${err.errors ? ' - ' + JSON.stringify(err.errors) : ''}`);
      }
    }

    return false;
  }
}

export const googleSheetsService = new GoogleSheetsService();
