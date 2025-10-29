import { IsMongoId, IsNumber, IsOptional, IsString } from 'class-validator';

export class RaiseDisputeDto {
  @IsMongoId()
  orderId: string;

  @IsMongoId()
  shipmentId: string;

  @IsString()
  disputeType: string; // SHORTAGE | QC_FAILURE | DOCS_MISSING | DAMAGE | OTHER

  @IsNumber()
  claimValue: number;

  @IsOptional()
  @IsString()
  description?: string;
}
