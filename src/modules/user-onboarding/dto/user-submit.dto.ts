import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UserSubmitDto {
  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsBoolean()
  @IsNotEmpty()
  dataAccuracyConfirmed: boolean;

  @IsBoolean()
  @IsOptional()
  agreeToCreditCheck?: boolean;

  @IsString()
  @IsOptional()
  additionalRemarks?: string;
}
