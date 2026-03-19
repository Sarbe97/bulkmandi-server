import { IsEnum, IsMongoId } from 'class-validator';
import { PaymentMethod } from '../../../common/constants/app.constants';

export class CreatePaymentDto {
  @IsMongoId()
  orderId: string;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
