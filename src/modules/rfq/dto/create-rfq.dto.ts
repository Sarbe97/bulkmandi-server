import { IsBoolean, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';
import { Incoterms, RfqStatus } from '../../../common/constants/app.constants';


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

  @IsEnum(Incoterms)
  incoterm: Incoterms;

  @IsString()
  @IsNotEmpty()
  @IsEnum(['SELF_PICKUP', 'SELLER_MANAGED', 'PLATFORM_3PL'])
  logisticsPreference: string;

  @IsString()
  @IsNotEmpty()
  buyerOrgName: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @IsString()
  @IsOptional()
  @IsEnum(RfqStatus)
  status?: RfqStatus;
}


