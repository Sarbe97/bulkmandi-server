import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsNumber, IsOptional, IsString } from "class-validator";

export class UpdateBuyerPreferenceDto {
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) categories?: string[];
  @ApiPropertyOptional() @IsOptional() @IsNumber() typicalMonthlyVolumeMT?: number;
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) incoterms?: string[];
  @ApiPropertyOptional({ type: [String] }) @IsOptional() @IsArray() @IsString({ each: true }) deliveryPins?: string[];
  @ApiPropertyOptional() @IsOptional() @IsString() acceptanceWindow?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() qcRequirement?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyEmail?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifySMS?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() notifyWhatsApp?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdateSellerPreferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsArray() catalogProducts?: any[];
  @ApiPropertyOptional() @IsOptional() @IsArray() plantLocations?: any[];
  @ApiPropertyOptional() @IsOptional() logisticsPreference?: any;
}

export class UpdateLogisticPreferenceDto {
  @ApiPropertyOptional() @IsOptional() @IsArray() fleetTypes?: any[];
  @ApiPropertyOptional() @IsOptional() @IsString() insuranceExpiry?: string;
  @ApiPropertyOptional() @IsOptional() policyDocument?: any;
  @ApiPropertyOptional() @IsOptional() @IsString() ewayBillIntegration?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() podMethod?: string;
}
