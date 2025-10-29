import { IsMongoId } from 'class-validator';

export class AcceptQuoteDto {
  @IsMongoId()
  quoteId: string;
}
