import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateNested,
} from 'class-validator';

class PlantLocationDto {
  @IsString()
  @IsOptional()
  street?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsOptional()
  pincode: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  gstStateCode?: string;
}

class ContactDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsOptional()
  role?: string;
}

export class UserOrgKycDto {
  @IsString()
  @IsNotEmpty()
  legalName: string;
 
  @IsString()
  @IsOptional()
  tradeName?: string;

  @IsString()
  @IsNotEmpty()
  // @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1Z]{1}[0-9A-Z]{1}$/, {
  //   message: 'Invalid GSTIN format',
  // })
  gstin: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, {
    message: 'Invalid PAN format',
  })
  pan: string;

  @Transform((value) => (value ? undefined : value))
  @IsOptional()
  @Matches(/^[A-Z0-9]{21}$/, {
    message: 'Invalid CIN format',
  })
  cin?: string;

  @IsString()
  @IsNotEmpty()
  registeredAddress: string;

  @IsString()
  @IsNotEmpty()
  businessType: string;

  @IsString()
  @IsOptional()
  incorporationDate?: string;

  @ValidateNested()
  @Type(() => ContactDto)
  @IsNotEmpty()
  primaryContact: ContactDto;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => PlantLocationDto)
  plantLocations?: PlantLocationDto[];
}
