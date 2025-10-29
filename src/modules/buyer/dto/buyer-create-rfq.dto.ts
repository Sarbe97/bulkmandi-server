import {
    IsDateString,
    IsEnum,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString
} from 'class-validator';

export class BuyerCreateRfqDto {
  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  grade: string;

  @IsNumber()
  quantityMT: number;

  @IsString()
  @IsNotEmpty()
  targetPin: string;

  @IsDateString()
  deliveryBy: string;

  @IsEnum(['DAP', 'FOB', 'CIF', 'EXW'])
  incoterm: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
