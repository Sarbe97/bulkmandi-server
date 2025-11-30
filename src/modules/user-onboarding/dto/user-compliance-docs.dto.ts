import { Transform, Type } from "class-transformer";
import { IsArray, IsBoolean, IsNotEmpty, ValidateNested } from "class-validator";
import { DocumentDto } from "./document.dto";



export class UserComplianceDocsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentDto)
  @IsNotEmpty()
  documents: DocumentDto[];

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  warrantyAssurance: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === "string") {
      return value.toLowerCase() === "true";
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  amlCompliance: boolean;
}
