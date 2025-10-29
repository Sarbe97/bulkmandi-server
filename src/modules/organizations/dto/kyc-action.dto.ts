import { IsOptional, IsString } from 'class-validator';

export class KycActionDto {
  @IsOptional()
  @IsString()
  remarks?: string;
}
