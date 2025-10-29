import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SubmitKycDto {
  @IsString()
  @IsNotEmpty()
  documentType: string;

  @IsString()
  @IsNotEmpty()
  documentNumber: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
