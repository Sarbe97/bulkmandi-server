import { IsNumber, IsOptional, IsString } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  resolutionType: string; // e.g. REFUND, CREDIT, etc.

  @IsOptional()
  @IsString()
  decisionNotes?: string;

  @IsOptional()
  @IsNumber()
  sellerRefund?: number;

  @IsOptional()
  @IsNumber()
  buyerCredit?: number;
}
