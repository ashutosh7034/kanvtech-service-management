import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly uploadDir: string;
  private readonly driver: 's3' | 'local';
  private readonly bucket: string;

  constructor() {
    this.driver = (process.env.STORAGE_DRIVER || 'local').toLowerCase() as 's3' | 'local';
    this.uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    this.bucket = process.env.S3_BUCKET || 'kanvtech-attachments';

    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }

    if (this.driver === 's3') {
      try {
        this.s3Client = new S3Client({
          region: process.env.S3_REGION || 'us-east-1',
          endpoint: process.env.S3_ENDPOINT || undefined,
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY || '',
            secretAccessKey: process.env.S3_SECRET_KEY || '',
          },
          forcePathStyle: true,
        });
        this.logger.log(`Initialized S3 Storage client for bucket ${this.bucket}`);
      } catch (err: any) {
        this.logger.warn(`Failed to initialize S3 client: ${err.message}. Falling back to local storage.`);
      }
    }
  }

  validateFile(file: Express.Multer.File): void {
    const allowedExts = ['.pdf', '.png', '.jpg', '.jpeg', '.xlsx', '.xls', '.docx', '.csv', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedExts.includes(ext)) {
      throw new BadRequestException(`File extension '${ext}' is not authorized for upload. Permitted: PDF, PNG, JPG, TXT, DOCX, XLSX.`);
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds maximum permitted limit of 10MB.');
    }
  }

  async upload(file: Express.Multer.File): Promise<{ filePath: string; fileName: string; fileSize: number; mimeType: string }> {
    this.validateFile(file);

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    const storageKey = `${uniqueSuffix}-${sanitizedName}`;

    if (this.driver === 's3' && this.s3Client) {
      try {
        await this.s3Client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: storageKey,
            Body: file.buffer,
            ContentType: file.mimetype,
          }),
        );
        return {
          filePath: `s3://${this.bucket}/${storageKey}`,
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
        };
      } catch (err: any) {
        this.logger.warn(`S3 upload error (${err.message}). Saving to local persistent volume.`);
      }
    }

    // Local disk persistence fallback
    const targetPath = path.join(this.uploadDir, storageKey);
    if (file.buffer) {
      await fs.promises.writeFile(targetPath, file.buffer);
    } else if (file.path && fs.existsSync(file.path)) {
      await fs.promises.copyFile(file.path, targetPath);
    }

    return {
      filePath: `/uploads/${storageKey}`,
      fileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
    };
  }
}
