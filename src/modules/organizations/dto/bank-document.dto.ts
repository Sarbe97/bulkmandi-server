import { IsString } from 'class-validator';

export class BankDocumentDto {
  @IsString()
  type: string; // CANCELLED_CHEQUE, BANK_LETTER

  fileName: string; // Set automatically
  fileUrl: string; // Set automatically
  uploadedAt: Date; // Set automatically
  status: string = 'UPLOADED'; // Default
}
