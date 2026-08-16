import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';
import { logger } from '../config/logger';

class S3Service {
  private client: S3Client | null = null;

  constructor() {
    if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_STORAGE_BUCKET_NAME) {
      this.client = new S3Client({
        region: env.AWS_S3_REGION_NAME,
        credentials: {
          accessKeyId: env.AWS_ACCESS_KEY_ID,
          secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        },
      });
    }
  }

  async uploadFile(
    fileBuffer: Buffer,
    fileName: string,
    contentType: string = 'application/octet-stream'
  ): Promise<string> {
    if (!this.client || !env.AWS_STORAGE_BUCKET_NAME) {
      logger.warn(`AWS S3 not configured. Returning local mock URL for: ${fileName}`);
      return `/static/${fileName}`;
    }

    const key = `uploads/${Date.now()}-${fileName}`;
    const command = new PutObjectCommand({
      Bucket: env.AWS_STORAGE_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    });

    await this.client.send(command);
    return `https://${env.AWS_STORAGE_BUCKET_NAME}.s3.${env.AWS_S3_REGION_NAME}.amazonaws.com/${key}`;
  }

  async getPresignedUrl(key: string, expiresInSeconds: number = 3600): Promise<string> {
    if (!this.client || !env.AWS_STORAGE_BUCKET_NAME) {
      return `/static/${key}`;
    }

    const command = new GetObjectCommand({
      Bucket: env.AWS_STORAGE_BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}

export const s3Service = new S3Service();
