import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class GradeDto {
  @IsString()
  code: string;

  @IsString()
  name: string;
}

export class PlantLocationDto {
  @IsString()
  name: string;

  @IsString()
  pin: string;

  @IsString()
  address: string;
}

export class CreateCatalogDto {
  @IsArray()
  @IsString({ each: true })
  categories: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeDto)
  grades: GradeDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlantLocationDto)
  plantLocations: PlantLocationDto[];

  @IsOptional()
  @IsString()
  status?: string;
}
