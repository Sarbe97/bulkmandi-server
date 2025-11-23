import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class BuyerPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  categories: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  typicalMonthlyVolumeMT?: number;

  @IsArray()
  @IsEnum(['DAP', 'EXW', 'FCA', 'CPT', 'CIP', 'DDP'], {
    each: true,
  })
  @IsNotEmpty()
  incoterms: string[];
 
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  deliveryPins: string[];

  @IsEnum(['24h', '48h', '72h'])
  @IsNotEmpty()
  acceptanceWindow: string;

  @IsEnum(['VISUAL_WEIGHT', 'LAB_REQUIRED'])
  @IsNotEmpty()
  qcRequirement: string;

  @IsBoolean()
  @IsOptional()
  notifyEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  notifySMS?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyWhatsApp?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
