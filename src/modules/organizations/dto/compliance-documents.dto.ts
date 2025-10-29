import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsString, ValidateNested } from 'class-validator';

export class ComplianceDocumentDto {
  @IsString() type: string;
  @IsString() fileName: string;
  @IsString() fileUrl: string;
  @IsDateString() uploadedAt: string;
  @IsString() status: string;
}

export class UpdateComplianceDocumentsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComplianceDocumentDto)
  complianceDocuments: ComplianceDocumentDto[];
}
