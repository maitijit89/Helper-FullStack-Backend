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
      logger.info('Cloudflare R2 credentials not configured.');
    }
  }

  get isConfigured(): boolean {
    return Boolean(this.client && this.bucket);
  }

  get provider(): string {
    return this.isConfigured ? 'cloudflare-r2' : 'unconfigured';
  }

  async putObject(
    key: string,
    fileBuffer: Buffer,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!this.client || !this.bucket) {
      throw new Error('Cloudflare R2 client is not configured');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    if (env.CLOUDFLARE_R2_PUBLIC_URL) {
      const publicBase = env.CLOUDFLARE_R2_PUBLIC_URL.replace(/\/+$/, '');
      return `${publicBase}/${key}`;
    }

    return this.getPresignedUrl(key, 86400 * 7);
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!this.client || !this.bucket) {
      throw new Error('Cloudflare R2 client is not configured');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }

  async deleteObject(key: string): Promise<boolean> {
    if (!this.client || !this.bucket) {
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
