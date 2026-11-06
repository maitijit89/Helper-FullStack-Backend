import multer from 'multer';

// Memory storage for direct streaming/uploading to Cloudflare R2
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max
});

export const uploadSingle = (fieldName: string = 'file') => memoryUpload.single(fieldName);
export const uploadMultiple = (fieldName: string = 'files', maxCount: number = 5) => memoryUpload.array(fieldName, maxCount);
