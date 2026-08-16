import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../config/logger';

class AIChatService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  async askAssistant(prompt: string, history?: Array<{ role: string; text: string }>): Promise<string> {
    if (!this.genAI) {
      logger.warn('Gemini API key is not set. Returning canned response.');
      return `I am the Helper Support Bot! How can I help you today with your orders, print xerox services, or delivery inquiries?`;
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: env.GEMINI_MODEL || 'gemini-1.5-flash',
        systemInstruction: `You are the friendly AI Support Assistant for Helper FullStack Platform. You help users with:
1. Quick Commerce ordering (snacks, beverages, cakes, stationery).
2. Document Print & Xerox pricing and pickup services.
3. Porter Courier delivery (packages < 5 kg).
4. Handwritten Assignment Writer services.
5. Order tracking, delivery partner information, and general queries.
Be polite, concise, and helpful.`,
      });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      logger.error(`Error querying Gemini AI: ${err.message}`);
      return `I am currently experiencing high demand. Please try again shortly or contact support directly!`;
    }
  }
}

export const aiChatService = new AIChatService();
