import { IsString, Length } from 'class-validator';

export class UpdateGstinDto {
  @IsString()
  @Length(15, 15) // GSTIN length is 15 chars in India
  gstin: string;
}
