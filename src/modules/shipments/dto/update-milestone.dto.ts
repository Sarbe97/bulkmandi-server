import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateMilestoneDto {
  @IsString()
  event: string; // For example: 'PICKUP', 'IN_TRANSIT', 'DELIVERED'

  @IsDateString()
  timestamp: string; // ISO date/time string

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  reportedBy?: string;
}
