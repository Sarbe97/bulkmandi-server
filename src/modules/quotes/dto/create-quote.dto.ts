import { IsMongoId, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

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
  @IsPositive()
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
}
