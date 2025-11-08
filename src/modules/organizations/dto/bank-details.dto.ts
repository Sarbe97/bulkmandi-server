import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { DocumentUplod as DocumentUpload } from '../schemas/organization.schema';

export class BankDetailsDto {
  @IsString()
  accountNumber: string;

  @IsString()
  ifsc: string;

  @IsString()
  bankName: string;

  @IsString()
  accountHolderName: string;

  @IsOptional()
  @IsString()
  pennyDropStatus?: string;

  @IsOptional()
  @IsNumber()
  pennyDropScore?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentUpload)
  documents: DocumentUpload[];
}
