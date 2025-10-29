import { IsEnum, IsMongoId } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  orderId: string;

  @IsEnum(['UPI', 'RTGS', 'NEFT', 'NETBANKING'])
  paymentMethod: 'UPI' | 'RTGS' | 'NEFT' | 'NETBANKING';
}
