import { IsEnum, IsOptional, IsString } from 'class-validator';
import { KYCStatus } from '../../../common/constants/app.constants';

export class UpdateKycStatusDto {
  @IsEnum(KYCStatus)
  status: KYCStatus;

  @IsOptional()
  @IsString()
  comments?: string;
}
