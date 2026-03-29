import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NegotiationsController } from './negotiations.controller';
import { NegotiationsService } from './negotiations.service';
import { Negotiation, NegotiationSchema } from './schemas/negotiation.schema';
import { Quote, QuoteSchema } from '../quotes/schemas/quote.schema';
import { Rfq, RfqSchema } from '../rfq/schemas/rfq.schema';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Negotiation.name, schema: NegotiationSchema },
      { name: Quote.name, schema: QuoteSchema },
      { name: Rfq.name, schema: RfqSchema },
    ]),
    OrganizationsModule,
    AuditModule,
  ],
  controllers: [NegotiationsController],
  providers: [NegotiationsService],
  exports: [NegotiationsService],
})
export class NegotiationsModule {}
