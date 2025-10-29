import { IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  docType: string; // LORRY_RECEIPT | QC_CERTIFICATE etc.

  @IsString()
  fileUrl: string;
}
