import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class RespondNegotiationDto {
  @IsNumber()
  @IsPositive()
  pricePerMT!: number;

  @IsNumber()
  @IsPositive()
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
