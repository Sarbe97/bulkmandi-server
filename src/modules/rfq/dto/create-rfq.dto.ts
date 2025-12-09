import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';


export class CreateRfqDto {
  @IsString()
  @IsNotEmpty()
  category: string;             // e.g., 'HR_COILS'

  @IsString()
  @IsNotEmpty()
  @IsString()
  @IsNotEmpty()
  grade: string;                // e.g., 'IS2062_E250'

  @IsString()
  @IsOptional()
  subCategory?: string;

  @IsString()
  @IsOptional()
  size?: string;

  @IsString()
  @IsOptional()
  tolerance?: string;

  @IsBoolean()
  @IsOptional()
  millTcRequired?: boolean;

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
  @IsOptional()
  notes?: string;
}

