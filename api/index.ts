import { Request, Response } from 'express';
import { app } from '../src/app';
import { connectDB } from '../src/config/database';

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Vercel serverless database connection error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
