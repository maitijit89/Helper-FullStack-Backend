import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure uploads folder structure exists safely
const baseUploadDir = path.resolve('uploads');
const productUploadDir = path.join(baseUploadDir, 'products');
const printUploadDir = path.join(baseUploadDir, 'print_documents');

try {
  if (!fs.existsSync(baseUploadDir)) fs.mkdirSync(baseUploadDir, { recursive: true });
  if (!fs.existsSync(productUploadDir)) fs.mkdirSync(productUploadDir, { recursive: true });
  if (!fs.existsSync(printUploadDir)) fs.mkdirSync(printUploadDir, { recursive: true });
} catch (err) {
  console.warn('Could not create local upload dirs (possibly read-only filesystem):', err);
}

// Memory storage for S3 uploads and PDF page counting
export const memoryUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB
});

// Disk storage for local file uploads
const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'product_image') {
      cb(null, productUploadDir);
    } else {
      cb(null, printUploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const diskUpload = multer({
  storage: diskStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
});
