import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateKycStatusDto {
  @IsEnum(['APPROVED', 'REJECTED', 'PENDING'])
  status: string;

  @IsOptional()
  @IsString()
  comments?: string;
}
