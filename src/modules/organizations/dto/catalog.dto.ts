import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsNumber, IsString, ValidateNested } from 'class-validator';

export class CatalogProductDto {
  @IsString() category: string;
  @IsBoolean() isSelected: boolean;
  @IsArray() @IsString({ each: true }) grades: string[];
  @IsNumber() moqPerOrder: number;
  @IsNumber() stdLeadTime: number;
}

export class PriceFloorDto {
  @IsString() category: string;
  @IsNumber() pricePerMT: number;
}

export class LogisticsPreferenceDto {
  @IsBoolean() usePlatform3PL: boolean;
  @IsBoolean() selfPickupAllowed: boolean;
}

export class UpdateCatalogDto {
  @ValidateNested({ each: true })
  @Type(() => CatalogProductDto)
  catalog: CatalogProductDto[];

  @ValidateNested({ each: true })
  @Type(() => PriceFloorDto)
  priceFloors: PriceFloorDto[];

  @ValidateNested()
  @Type(() => LogisticsPreferenceDto)
  logisticsPreference: LogisticsPreferenceDto;
}
