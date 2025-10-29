import { Type } from 'class-transformer';
import { IsArray, IsEnum, IsOptional, IsString, ValidateNested } from 'class-validator';
import { UserRole } from 'src/common/enums';
import { BankAccountDto } from './bank-account.dto';
import { OrgKycDto } from './org-kyc.dto';

export class UpdateOrganizationDto {
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsEnum(UserRole) role?: UserRole;

  @IsOptional() @ValidateNested() @Type(() => OrgKycDto) orgKyc?: OrgKycDto;

  @IsOptional() @ValidateNested() @Type(() => BankAccountDto) primaryBankAccount?: BankAccountDto;

  @IsOptional() @IsArray() completedSteps?: string[];

  @IsOptional() @IsString() kycStatus?: string;
}
