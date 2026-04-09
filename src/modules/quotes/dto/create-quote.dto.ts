import { IsMongoId, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';

export class CreateQuoteDto {
  @IsString()
  rfqId: string;

  @IsNumber()
  @IsPositive()
  pricePerMT: number;

  @IsNumber()
  @IsPositive()
  quantityMT: number;

  @IsNumber()
  @Min(0)
  freightPerMT: number;

  @IsNumber()
  @IsPositive()
  leadDays: number;

  @IsNumber()
  @IsPositive()
  validityHours: number;


  @IsString()
  paymentTerms: string;

  @IsOptional()
  @IsString()
  qualityTerms?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  priceJustification?: string;

  @IsOptional()
  @IsString()
  sellerPlant?: string;

  @IsOptional()
  @IsString()
  sellerPlantPin?: string;
}
