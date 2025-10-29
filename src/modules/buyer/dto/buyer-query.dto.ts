import { IsOptional, IsString } from 'class-validator';

export class BuyerQueryDto {
  @IsOptional()
  @IsString()
  status?: string;
}
