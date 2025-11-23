import { BadRequestException } from '@nestjs/common';
import { memoryStorage } from 'multer';

/**
 * Shared multer configuration for onboarding document uploads
 * Used by both Seller and Buyer modules
 * Handles file size limits, MIME type validation, and error handling
 */
export const onboardingMulterOptions = {
  storage: memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB per file
  },
  fileFilter: (req: any, file: Express.Multer.File, cb: any) => {
    const allowedMimes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new BadRequestException(
          'Invalid file type. Only PDF, JPG, PNG, DOC, DOCX allowed',
        ),
        false,
      );
    }
  },
};
