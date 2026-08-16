import { Request, Response } from 'express';
import { app } from '../src/app';
import { connectDB } from '../src/config/database';
import mongoose from 'mongoose';

let isConnected = false;

export default async function handler(req: Request, res: Response) {
  // Ensure database connection is established and reused across warm invocations
  if (!isConnected || mongoose.connection.readyState !== 1) {
    try {
      await connectDB();
      isConnected = true;
    } catch (err) {
      console.error('Failed to connect to MongoDB in serverless handler:', err);
    }
  }

  // Forward request to Express app
  return app(req, res);
}
