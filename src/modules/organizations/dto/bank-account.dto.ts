import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { BankDocumentDto } from './bank-document.dto';

export class BankAccountDto {
  @IsOptional() @IsString() accountNumber?: string;
  @IsOptional() @IsString() ifsc?: string;
  @IsOptional() @IsString() bankName?: string;
  @IsOptional() @IsString() accountHolderName?: string;
  @IsOptional() @IsString() accountType?: string;
  @IsOptional() @IsString() pennyDropStatus?: string;
  @IsOptional() @IsNumber() pennyDropScore?: number;
  @IsOptional() @ValidateNested({ each: true }) @Type(() => BankDocumentDto) documents?: BankDocumentDto[];
}
