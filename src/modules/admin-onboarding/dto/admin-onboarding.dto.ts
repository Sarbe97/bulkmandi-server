import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, Length, Matches, ValidateNested } from 'class-validator';
import { UserRole } from '../../../common/enums';

export class FastTrackUserDto {
  @ApiProperty({ example: 'seller1@bulkmandi.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @Length(10, 10)
  mobile: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ enum: UserRole })
  @IsEnum(UserRole)
  role: UserRole;
}

export class FastTrackOrganizationDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  legalName: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  tradeName?: string;

  @ApiProperty({ example: '07AAAAA0000A1Z5' })
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  gstin: string;

  @ApiProperty({ example: 'AAAAA0000A' })
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, { message: 'Invalid PAN format' })
  pan: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  cin?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  registeredAddress: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessType: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  incorporationDate?: string;
  
  // Minimal Contact
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  primaryContactRole?: string;

  @ApiPropertyOptional()
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  serviceStates?: string[];

  // Bank Info
  @ApiPropertyOptional()
  @IsObject()
  @IsOptional()
  bankDetails?: {
    accountNumber: string;
    accountHolderName: string;
    accountType: string;
    ifsc: string;
    bankName: string;
    branchName?: string;
  };
}

export class FastTrackOnboardDto {
  @ApiProperty({ type: FastTrackUserDto })
  @ValidateNested()
  @Type(() => FastTrackUserDto)
  user: FastTrackUserDto;

  @ApiProperty({ type: FastTrackOrganizationDto })
  @ValidateNested()
  @Type(() => FastTrackOrganizationDto)
  organization: FastTrackOrganizationDto;

  @ApiPropertyOptional({ description: 'Role-specific preferences' })
  @IsOptional()
  @IsObject()
  preferences?: Record<string, any>;

  @ApiPropertyOptional({ enum: ['ADMIN_SINGLE', 'ADMIN_BULK'] })
  @IsOptional()
  @IsEnum(['ADMIN_SINGLE', 'ADMIN_BULK'])
  creationSource?: 'ADMIN_SINGLE' | 'ADMIN_BULK';
}
