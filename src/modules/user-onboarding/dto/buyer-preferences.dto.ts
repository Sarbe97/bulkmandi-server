import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import {
  Incoterms,
  AcceptanceWindow,
  QCRequirement,
} from '../../../common/constants/app.constants';

export class BuyerPreferencesDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  categories: string[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  typicalMonthlyVolumeMT?: number;

  @IsArray()
  @IsEnum(Incoterms, { each: true })
  @IsNotEmpty()
  incoterms: Incoterms[];

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  deliveryPins: string[];

  @IsEnum(AcceptanceWindow)
  @IsNotEmpty()
  acceptanceWindow: AcceptanceWindow;

  @IsEnum(QCRequirement)
  @IsNotEmpty()
  qcRequirement: QCRequirement;

  @IsBoolean()
  @IsOptional()
  notifyEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  notifySMS?: boolean;

  @IsBoolean()
  @IsOptional()
  notifyWhatsApp?: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}
