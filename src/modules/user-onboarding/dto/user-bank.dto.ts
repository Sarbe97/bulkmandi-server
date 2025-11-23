import { Transform, Type } from "class-transformer";
import { IsArray, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, Min, ValidateNested } from "class-validator";

class DocumentDto {
  @IsString()
  @IsNotEmpty()
  docType: string;

  @IsString()
  @IsNotEmpty()
  fileName: string;

  @IsString()
  @IsNotEmpty()
  fileUrl: string;

  @IsString()
  @IsOptional()
  uploadedAt?: string;

  @IsString()
  @IsOptional()
  status?: string; // UPLOADED, PENDING, VERIFIED, REJECTED
}

export class UserBankDto {
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsString()
  @IsNotEmpty()
  accountHolderName: string;

  @Transform(({ value }) => value?.toUpperCase())
  @IsString()
  @IsNotEmpty()
  @Matches(/[A-Z]{4}0[A-Z0-9]{6}/, {
    message: "Invalid IFSC code format",
  })
  ifsc: string;

  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsOptional()
  branchName?: string;

  @IsEnum(["SAVINGS", "CURRENT", "OD"])
  @IsOptional()
  accountType?: string;

  @IsString()
  @IsNotEmpty()
  payoutMethod: string;

  @IsString()
  @IsOptional()
  upiDetails: string;

  // Backend sets this after penny-drop verification
  @IsEnum(["PENDING", "VERIFIED", "FAILED"])
  @IsOptional()
  pennyDropStatus?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  pennyDropScore?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  @IsOptional()
  documents?: DocumentDto[];
}
