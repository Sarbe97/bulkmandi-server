import { IsDate, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class DocumentDto {
  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsOptional()
  documentNumber?: string;

  @IsDate()
  @IsOptional()
  uploadedAt?: Date;

  @IsString()
  @IsOptional()
  status?: string; // UPLOADED, PENDING, VERIFIED, REJECTED
}
