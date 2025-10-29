import { IsArray, IsObject, IsString } from 'class-validator';

export class CreateBatchDto {
  @IsString()
  batchName: string;

  @IsObject()
  settlementWindow: {
    windowType: string;
    windowDate: string;
    startDate: string;
    endDate: string;
  };

  @IsArray()
  orderIds: string[];

  @IsObject()
  totals: {
    grossAmount: number;
    platformFees: number;
    disputeAdjustments: number;
    netPayable: number;
    lineItemCount: number;
  };
}
