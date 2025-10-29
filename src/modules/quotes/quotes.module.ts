import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { Quote, QuoteSchema } from './schemas/quote.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quote.name, schema: QuoteSchema }]),
    MongooseModule.forFeature([{ name: Rfq.name, schema: RfqSchema }]), // Import RFQ model here
  ],
  providers: [QuotesService],
  controllers: [QuotesController],
})
export class QuotesModule {}
