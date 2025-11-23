import { DocumentType } from "@common/enums";
import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, ValidateNested } from "class-validator";

class ComplianceDocumentDto {
  @IsEnum(DocumentType)
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

  @IsString()
  @IsOptional()
  uploadedAt?: string;

  @IsString()
  @IsOptional()
  status?: string; // UPLOADED, PENDING, VERIFIED, REJECTED
}

export class UserComplianceDocsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplianceDocumentDto)
  @IsNotEmpty()
  documents: ComplianceDocumentDto[];

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  warrantyAssurance: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  amlCompliance: boolean;
}
