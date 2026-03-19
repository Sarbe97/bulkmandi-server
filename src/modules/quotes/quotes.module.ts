import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { QuotesController } from './quotes.controller';
import { QuotesService } from './quotes.service';
import { Quote, QuoteSchema } from './schemas/quote.schema';

import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Quote.name, schema: QuoteSchema }]),
    MongooseModule.forFeature([{ name: Rfq.name, schema: RfqSchema }]),
    forwardRef(() => OrdersModule),
    AuthModule,
  ],

  providers: [QuotesService],
  controllers: [QuotesController],
})
export class QuotesModule { }
