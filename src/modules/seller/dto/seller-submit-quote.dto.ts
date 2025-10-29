import { IsMongoId, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';

export class SellerSubmitQuoteDto {
  @IsMongoId()
  rfqId: string;

  @IsNumber()
  @IsPositive()
  pricePerMT: number;

  @IsString()
  plantName: string;

  @IsString()
  plantPin: string;

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
