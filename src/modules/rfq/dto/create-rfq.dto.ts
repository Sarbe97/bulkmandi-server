import { IsDateString, IsEnum, IsNotEmpty, IsNumber, IsString } from 'class-validator';

export class CreateRfqDto {
  @IsString()
  @IsNotEmpty()
  category: string;             // e.g., 'HR_COILS'

  @IsString()
  @IsNotEmpty()
  grade: string;                // e.g., 'IS2062_E250'

  @IsNumber()
  quantityMT: number;

  @IsString()
  @IsNotEmpty()
  targetPin: string;

  @IsDateString()
  deliveryBy: string;

  @IsEnum(['DAP', 'FOB', 'CIF', 'EXW'])
  incoterm: string;

  @IsString()
  @IsNotEmpty()
  buyerOrgName: string;

  @IsString()
  @IsNotEmpty()
  notes?: string;
}
