import { IsOptional, IsString } from "class-validator";

export class BankDocumentDto {
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsString() fileName?: string;
  @IsOptional() @IsString() fileUrl?: string;
  @IsOptional() uploadedAt?: Date;
  @IsOptional() @IsString() status?: string;
}
