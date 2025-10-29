import { IsOptional, IsString } from 'class-validator';

export class AddressDto {
  @IsOptional() @IsString() street?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() pin?: string;
  @IsOptional() @IsString() country?: string;
}
