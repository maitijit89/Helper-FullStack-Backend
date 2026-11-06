import path from 'path';
import fs from 'fs';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';

export class S3Service {
  private client: S3Client | null = null;
  private bucket: string = '';
  private isR2: boolean = false;

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    const isR2Configured = Boolean(
      (env.CLOUDFLARE_R2_ACCOUNT_ID || env.CLOUDFLARE_R2_ENDPOINT) &&
      (env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID) &&
      (env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY)
    );

    if (env.STORAGE_PROVIDER === 'r2' || isR2Configured) {
      this.isR2 = true;
      this.bucket = env.CLOUDFLARE_R2_BUCKET_NAME || env.AWS_STORAGE_BUCKET_NAME;
      const accessKeyId = env.CLOUDFLARE_R2_ACCESS_KEY_ID || env.AWS_ACCESS_KEY_ID;
      const secretAccessKey = env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || env.AWS_SECRET_ACCESS_KEY;
      const endpoint = env.CLOUDFLARE_R2_ENDPOINT || (
        env.CLOUDFLARE_R2_ACCOUNT_ID ? `https://${env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : undefined
      );

      if (accessKeyId && secretAccessKey && this.bucket) {
        this.client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        logger.info(`Initialized Cloudflare R2 Storage Service (bucket: ${this.bucket})`);
        return;
      }
    }

    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_STORAGE_BUCKET_NAME) {
      this.bucket = env.AWS_STORAGE_BUCKET_NAME;
      this.client = new S3Client({
        region: env.AWS_S3_REGION_NAME,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });
      logger.info(`Initialized AWS S3 Storage Service (bucket: ${this.bucket}, region: ${env.AWS_S3_REGION_NAME})`);
    } else {
      logger.info('Cloud storage credentials not detected. Operating with local filesystem storage.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  get provider(): string {
    if (!this.client) return 'local';
    return this.isR2 ? 'cloudflare-r2' : 'aws-s3';
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!this.client || !this.bucket) {
      return this.saveLocalFile(fileBuffer, fileName);
    }

    try {
      const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${Date.now()}-${cleanName}`;
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      });

      await this.client.send(command);

      // Cloudflare R2 custom domain or public endpoint URL
      if (this.isR2 && env.CLOUDFLARE_R2_PUBLIC_URL) {
        const publicBase = env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '');
        return `${publicBase}/${key}`;
      }

      // AWS S3 standard public URL
      if (!this.isR2) {
        return `https://${this.bucket}.s3.${env.AWS_S3_REGION_NAME}.amazonaws.com/${key}`;
      }

      // If R2 without custom domain, generate presigned get URL or return key reference
      return await this.getPresignedUrl(key, 86400 * 7); // 7-day presigned link
    } catch (err: any) {
      logger.warn(`Storage upload error (${this.provider}): ${err.message}. Falling back to local public storage.`);
      return this.saveLocalFile(fileBuffer, fileName);
    }
  }

  private saveLocalFile(fileBuffer: Buffer, fileName: string): string {
    const cleanName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeName = `${Date.now()}-${cleanName}`;
    const uploadDir = path.resolve('uploads', 'products');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    fs.writeFileSync(path.join(uploadDir, safeName), fileBuffer);
    logger.info(`Saved file to local public static directory: uploads/products/${safeName}`);
    return `/static/products/${safeName}`;
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
}

export const s3Service = new S3Service();
export const r2Service = s3Service;
export const storageService = s3Service;
