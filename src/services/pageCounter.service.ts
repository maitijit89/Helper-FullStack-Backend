import pdfParse from 'pdf-parse';
import { logger } from '../config/logger';

class PageCounterService {
  /**
   * Reads a PDF buffer and returns the total number of pages.
   */
  async countPdfPages(buffer: Buffer): Promise<{ num_pages: number; text_sample?: string }> {
    try {
      const data = await pdfParse(buffer);
      const numPages = Math.max(1, data.numpages || 1);
      const textSample = data.text ? data.text.slice(0, 300).trim() : undefined;
      return { num_pages: numPages, text_sample: textSample };
    } catch (err: any) {
      logger.error(`Error parsing PDF document: ${err.message}`);
      // Fallback default to 1 page if parsing fails or non-PDF binary
      return { num_pages: 1 };
    }
  }
}

export const pageCounterService = new PageCounterService();
