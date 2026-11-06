import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class CloudflareR2Service {
  private client: S3Client | null = null;
  private bucket: string = '';

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const accountId = env.CLOUDFLARE_R2_ACCOUNT_ID;
    const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID;
    const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
    this.bucket = env.CLOUDFLARE_R2_BUCKET_NAME;

    const endpoint = env.CLOUDFLARE_R2_ENDPOINT || (
      accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined
    );

    if (accessKeyId && secretAccessKey && this.bucket && endpoint) {
      try {
        this.client = new S3Client({
          region: 'auto', // Cloudflare R2 requires region: 'auto'
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        logger.info(`Initialized Cloudflare R2 Storage Service (bucket: ${this.bucket})`);
      } catch (err: any) {
        logger.warn(`Failed to initialize Cloudflare R2 client: ${err.message}`);
      }
    } else {
      logger.info('Cloudflare R2 credentials not configured. Operating with local filesystem storage.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  get provider(): string {
    return this.isConfigured ? 'cloudflare-r2' : 'local';
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream',
    folder: string = 'uploads'
  ): Promise<string> {
    if (!this.client || !this.bucket) {
      return this.saveLocalFile(fileBuffer, fileName, folder);
    }

    try {
      const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `${folder}/${Date.now()}-${cleanName}`;
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      // Cloudflare R2 custom domain or public endpoint URL
      if (env.CLOUDFLARE_R2_PUBLIC_URL) {
        const publicBase = env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '');
        return `${publicBase}/${key}`;
      }

      // If no public domain, return 7-day presigned URL
      return await this.getPresignedUrl(key, 86400 * 7);
    } catch (err: any) {
      logger.warn(`Cloudflare R2 upload error: ${err.message}. Falling back to local storage.`);
      return this.saveLocalFile(fileBuffer, fileName, folder);
    }
  }

  private saveLocalFile(fileBuffer: Buffer, fileName: string, folder: string = 'uploads'): string {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeName = `${Date.now()}-${cleanName}`;
    const uploadDir = path.resolve('uploads', folder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, safeName), fileBuffer);
    logger.info(`Saved file to local storage: uploads/${folder}/${safeName}`);
    return `/static/${folder}/${safeName}`;
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!this.client || !this.bucket) {
      return `/static/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteFile(key: string): Promise<boolean> {
    if (!this.client || !this.bucket) {
      const localPath = path.resolve('uploads', key);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        return true;
      }
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.client.send(command);
      return true;
    } catch (err: any) {
      logger.warn(`Cloudflare R2 delete error: ${err.message}`);
      return false;
    }
  }
}

export const r2Service = new CloudflareR2Service();
export const storageService = r2Service;
