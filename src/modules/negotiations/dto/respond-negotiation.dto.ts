import { IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class RespondNegotiationDto {
  @IsNumber()
  @Min(1)
  pricePerMT!: number;

  @IsNumber()
  @Min(0)
  freightPerMT!: number;

  @IsNumber()
  @IsPositive()
  quantityMT!: number;

  @IsNumber()
  @IsPositive()
  leadDays!: number;

  @IsOptional()
  @IsString()
  paymentTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
