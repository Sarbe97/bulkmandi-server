import { IsNotEmpty, IsString } from 'class-validator';

export class UploadDocumentDto {
  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsNotEmpty()
  fileHash: string;
}
