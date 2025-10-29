import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateKycStatusDto {
  @IsEnum(['APPROVED', 'REJECTED', 'IN_REVIEW'])
  status: string;

  @IsOptional()
  @IsString()
  comments?: string;
}
