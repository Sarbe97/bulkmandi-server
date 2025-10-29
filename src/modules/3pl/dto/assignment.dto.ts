import { IsMongoId } from 'class-validator';

export class AssignmentDto {
  @IsMongoId()
  shipmentId: string;

  @IsMongoId()
  carrierId: string; // 3PL organization ID
}
