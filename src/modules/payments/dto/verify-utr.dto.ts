import { IsString, MinLength } from 'class-validator';

export class VerifyUtrDto {
  @IsString()
  @MinLength(12)
  utr: string;
}
