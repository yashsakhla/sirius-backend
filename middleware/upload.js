import multer from 'multer';
import path from 'path';
import fs from 'fs';

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

const productsUploadDir = path.join(process.cwd(), 'uploads', 'products');
ensureDirSync(productsUploadDir);

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, productsUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ext && ext.length <= 10 ? ext : '';
    const base = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${base}${safeExt}`);
  }
});

export const uploadProductImages = multer({
  storage,
  limits: { files: 10, fileSize: 10 * 1024 * 1024 } // 10 files, 10MB each
});

