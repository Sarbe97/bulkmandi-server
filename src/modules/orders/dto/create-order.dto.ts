import { IsMongoId, IsNumber, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsMongoId()
  rfqId: string;

  @IsMongoId()
  quoteId: string;

  @IsMongoId()
  buyerId: string;

  @IsMongoId()
  sellerId: string;

  @IsString()
  incoterm: string;

  @IsNumber()
  deliveryBy: number;

  @IsString()
  status: string; // E.g., 'CONFIRMED'

  // You can add further product/pricing/delivery fields as in your order.schema.ts
}
