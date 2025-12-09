import { PlantLocationDto } from '@modules/catalog/dto/create-catalog.dto';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class CatalogProductDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsBoolean()
  @IsNotEmpty()
  isSelected: boolean;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  grades: string[];

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  moqPerOrder: number;

  @IsNumber()
  @Min(0)
  @IsNotEmpty()
  stdLeadTime: number;

  @IsArray()
  @IsString({ each: true })
  availability: string[];

  // Moved from PriceFloorDto
  @IsNumber()
  @Min(0)
  @IsNotEmpty() // Or @IsOptional() if not strictly required for all
  pricePerMT: number;
}



class LogisticsPreferenceDto {
  @IsBoolean()
  @IsNotEmpty()
  usePlatform3PL: boolean;

  @IsBoolean()
  @IsNotEmpty()
  selfPickupAllowed: boolean;
}

export class SellerCatalogDto {
  @Type(() => CatalogProductDto)
  @IsNotEmpty()
  catalogProducts: CatalogProductDto[];

  // Removed PriceFloorDto


  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlantLocationDto)
  @IsNotEmpty()
  plantLocations: PlantLocationDto[];

  @ValidateNested()
  @Type(() => LogisticsPreferenceDto)
  @IsNotEmpty()
  logisticsPreference: LogisticsPreferenceDto;
}
