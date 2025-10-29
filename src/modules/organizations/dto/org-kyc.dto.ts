import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { AddressDto } from './address.dto'; // your existing or create these accordingly
import { ContactDto } from './contact.dto';

export class OrgKycDto {
  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  tradeName?: string;

  @IsOptional()
  @IsString()
  gstin?: string;

  @IsOptional()
  @IsString()
  pan?: string;

  @IsOptional()
  @IsString()
  registeredAddress?: string;

  @IsOptional()
  @IsString()
  businessType?: string;

  @IsOptional()
  @IsString()
  incorporationDate?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  plantLocations?: AddressDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  primaryContact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  secondaryContact?: ContactDto;
}
