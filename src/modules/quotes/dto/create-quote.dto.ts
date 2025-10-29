import { IsMongoId, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class CreateQuoteDto {
  @IsMongoId()
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

  @IsOptional()
  @IsString()
  notes?: string;
}
