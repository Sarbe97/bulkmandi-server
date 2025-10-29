import { IsEmail, IsOptional, IsString } from 'class-validator';

export class ContactDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() role?: string;
}
