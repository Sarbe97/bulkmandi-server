import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty } from 'class-validator';

export class ComplianceDocsDto {
  @IsBoolean()
  @Transform(({ value }) => {
    // Convert string 'true'/'false' to actual boolean
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  warrantyAssurance: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }
    return Boolean(value);
  })
  @IsNotEmpty()
  amlCompliance: boolean;
}
