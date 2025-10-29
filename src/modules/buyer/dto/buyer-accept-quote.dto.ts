import { IsMongoId } from 'class-validator';

export class BuyerAcceptQuoteDto {
  @IsMongoId()
  quoteId: string;
}
