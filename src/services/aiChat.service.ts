import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { logger } from '../config/logger';

export interface AIChatHistoryPart {
  text?: string;
  [key: string]: any;
}

export interface AIChatHistoryItem {
  role?: string;
  parts?: Array<AIChatHistoryPart | string> | string;
  text?: string;
  content?: string;
  message?: string;
  [key: string]: any;
}

function normalizeHistoryForGemini(history?: AIChatHistoryItem[]): Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> {
  if (!history || !Array.isArray(history) || history.length === 0) {
    return [];
  }

  const formatted: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];

  for (const item of history) {
    if (!item) continue;
    const rawRole = (item.role || 'user').toLowerCase();
    const role: 'user' | 'model' = rawRole === 'model' || rawRole === 'assistant' || rawRole === 'bot' ? 'model' : 'user';

    let text = '';
    if (Array.isArray(item.parts)) {
      text = item.parts
        .map((p) => {
          if (typeof p === 'string') return p;
          if (p && typeof p.text === 'string') return p.text;
          return '';
        })
        .filter(Boolean)
        .join('\n');
    } else if (typeof item.parts === 'string') {
      text = item.parts;
    } else if (typeof item.text === 'string') {
      text = item.text;
    } else if (typeof item.content === 'string') {
      text = item.content;
    } else if (typeof item.message === 'string') {
      text = item.message;
    }

    const trimmedText = text.trim();
    if (trimmedText) {
      formatted.push({
        role,
        parts: [{ text: trimmedText }],
      });
    }
  }

  // Gemini chat requires the history to start with a 'user' turn.
  // If the history starts with 'model' (e.g. welcome message), drop leading 'model' messages.
  while (formatted.length > 0 && formatted[0].role === 'model') {
    formatted.shift();
  }

  // Merge consecutive messages with the same role if any
  const merged: Array<{ role: 'user' | 'model'; parts: [{ text: string }] }> = [];
  for (const msg of formatted) {
    if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
      merged[merged.length - 1].parts[0].text += `\n${msg.parts[0].text}`;
    } else {
      merged.push({ role: msg.role, parts: [{ text: msg.parts[0].text }] });
    }
  }

  return merged;
}

function getSmartCampusFallback(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('snack') || p.includes('maggi') || p.includes('food') || p.includes('drink') || p.includes('order') || p.includes('cart')) {
    return "🍿 **Late-Night Campus Snacks & Quick Store:**\n\n- **Maggi 2-Minute Masala Pack (4-in-1)** — ₹48 *(Best Seller)*\n- **Red Bull Energy Drink (250ml)** — ₹115 *(Chilled)*\n- **Lays Magic Masala Party Pack** — ₹45\n- **Amul Taaza Milk (500ml)** — ₹34\n\n👉 Add items to your cart for **15-minute room delivery**!";
  }
  if (p.includes('print') || p.includes('xerox') || p.includes('page') || p.includes('binding') || p.includes('cost') || p.includes('pdf')) {
    return "📄 **Print & Xerox Pricing & Pickup Guide:**\n\n- **Black & White:** ₹2.00 per page\n- **Full Color:** ₹5.00 per page\n- **Double-Sided (Back-to-Back):** Supported with zero extra charge\n- **Spiral Binding:** +₹25 per booklet\n- **Hard Bound Thesis:** +₹90\n\n🚀 Simply upload your PDF under the **Print & Xerox Hub** for fast campus delivery or pickup!";
  }
  if (p.includes('assignment') || p.includes('handwriting') || p.includes('write') || p.includes('notes')) {
    return "✍️ **Handwritten Assignment Writer Service:**\n\nOverloaded with lab manuals or written record submissions?\n- **Standard Rate:** ₹15 per page (48 hrs)\n- **Express Rush:** ₹22 per page (24 hrs)\n- **Emergency:** ₹35 per page (6-12 hrs)\n- **Styles:** Choose between Neat Print, Natural Student Script, Cursive, or Engineering Diagrams.\n\nVisit the **Assignment Writer** section to submit your request!";
  }
  if (p.includes('porter') || p.includes('courier') || p.includes('package') || p.includes('parcel') || p.includes('kg')) {
    return "📦 **Porter Courier Service (< 5 kg):**\n\n- Campus-wide fast delivery for packages and essentials under 5 kg.\n- Real-time GPS tracking with verified student delivery partners.\n- Flat, transparent rates across hostels and campus departments!";
  }
  if (p.includes('delivery') || p.includes('fast') || p.includes('time') || p.includes('track') || p.includes('status')) {
    return "🚚 **15-Minute Campus Delivery Guarantee:**\n\n- Snack, stationery, and urgent orders are packed immediately from campus inventory.\n- Riders deliver straight to your hostel room door with live GPS tracking.\n- Track any ongoing order in **My Orders**!";
  }
  return `👋 I am the Helper Campus Support Assistant! I can help you with 15-min snack deliveries, document printing & spiral binding, porter parcel delivery (<5kg), and handwritten assignment writing. How can I assist you today?`;
}

class AIChatService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor() {
    if (env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    }
  }

  async askAssistant(prompt: string, history?: AIChatHistoryItem[]): Promise<string> {
    if (!this.genAI) {
      logger.warn('Gemini API key is not set. Returning canned response.');
      return getSmartCampusFallback(prompt);
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

      const normalizedHistory = normalizeHistoryForGemini(history);

      if (normalizedHistory.length > 0) {
        try {
          const chat = model.startChat({
            history: normalizedHistory,
          });
          const result = await chat.sendMessage(prompt);
          return result.response.text();
        } catch (chatErr: any) {
          logger.warn(`Gemini chat session failed, falling back to generateContent: ${chatErr.message}`);
          const combinedPrompt = `Context history:\n${normalizedHistory.map(h => `${h.role}: ${h.parts[0].text}`).join('\n')}\n\nUser: ${prompt}`;
          const result = await model.generateContent(combinedPrompt);
          return result.response.text();
        }
      }

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err: any) {
      logger.error(`Error querying Gemini AI: ${err.message}`);
      return getSmartCampusFallback(prompt);
    }
  }
}

export const aiChatService = new AIChatService();

