import { IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class RaiseDisputeDto {
  @IsMongoId()
  orderId: string;

  @IsOptional()
  @IsMongoId()
  shipmentId?: string;

  @IsString()
  disputeType: string; // SHORTAGE | QC_FAILURE | DOCS_MISSING | DAMAGE | OTHER

  @IsNumber()
  claimValue: number;

  @IsString()
  description: string;

  @IsString()
  claimantRole: string; // BUYER | SELLER

  @IsMongoId()
  respondentId: string;

  @IsString()
  respondentRole: string; // BUYER | SELLER
}
