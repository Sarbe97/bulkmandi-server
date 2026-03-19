import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsEnum, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { DocumentDto } from './document.dto';
import { EwayBillIntegration, EWAY_BILL_INTEGRATION_VALUES, POD_METHOD_VALUES } from '../../../common/constants/app.constants';
import type { PodMethod } from '../../../common/constants/app.constants';

// Fleet types are now managed in database via master-data module
export type FleetTypeOption = string;

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

  @IsEnum(EWAY_BILL_INTEGRATION_VALUES)
  ewayBillIntegration: EwayBillIntegration;

  @IsEnum(POD_METHOD_VALUES)
  podMethod: PodMethod;
}
