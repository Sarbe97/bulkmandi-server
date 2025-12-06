import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { DocumentDto } from './document.dto';

export type FleetTypeOption = '20t_open' | '25t_trailer' | 'covered_16t' | string;

export class FleetTypeItemDto {
  @IsString()
  type: FleetTypeOption;

  @IsString()
  label: string;

  @IsNumber()
  @Min(0)
  vehicleCount: number;
}

export class FleetAndComplianceFormDataDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FleetTypeItemDto)
  @ArrayMinSize(1)
  fleetTypes: FleetTypeItemDto[];

  @IsString()
  insuranceExpiry: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => DocumentDto) // reuse your DocumentUpload DTO
  policyDocument?: DocumentDto;

  @IsEnum(['api', 'manual'])
  ewayBillIntegration: 'api' | 'manual';

  @IsEnum(['driver_app', 'pdf'])
  podMethod: 'driver_app' | 'pdf';
}
