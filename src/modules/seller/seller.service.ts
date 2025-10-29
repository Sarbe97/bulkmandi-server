import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Organization, OrganizationDocument } from '../organizations/schemas/organization.schema';
import { Quote, QuoteDocument } from '../quotes/schemas/quote.schema';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { SellerSubmitQuoteDto } from './dto/seller-submit-quote.dto';

@Injectable()
export class SellerService {
  constructor(
    @InjectModel(Organization.name) private orgModel: Model<OrganizationDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>
  ) {}

  async submitQuote(sellerOrgId: string, dto: SellerSubmitQuoteDto) {
    // Check RFQ exists and is OPEN
    const rfq = await this.rfqModel.findById(dto.rfqId);
    if (!rfq || rfq.status !== 'OPEN') throw new BadRequestException('RFQ not open');

    // Prevent submitting if seller already quoted
    const exists = await this.quoteModel.findOne({
      rfqId: dto.rfqId,
      sellerId: sellerOrgId
    });
    if (exists) throw new BadRequestException('Already quoted on this RFQ');

    // Validate price floor if using catalog rules...

    // Calculate totals
    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;

    // Create quote
    const quote = new this.quoteModel({
      rfqId: dto.rfqId,
      sellerId: sellerOrgId,
      pricePerMT: dto.pricePerMT,
      quantityMT: dto.quantityMT,
      plantName: dto.plantName,
      plantPin: dto.plantPin,
      freightPerMT: dto.freightPerMT,
      totalFreight: freightTotal,
      totalPriceBase: baseAmount,
      grandTotal,
      leadDays: dto.leadDays,
      notes: dto.notes,
      status: 'ACTIVE',
      submittedAt: new Date()
    });
    return quote.save();
  }

  async getMyQuotes(sellerOrgId: string, status: string) {
    const filter: any = { sellerId: sellerOrgId };
    if (status) filter.status = status;
    return this.quoteModel.find(filter).sort({ submittedAt: -1 });
  }

  async getMyOrders(sellerOrgId: string, status: string) {
    // Reference orders by sellerId, status
    // Implementation will depend on your OrderService/Order model
    return []; // Placeholder for integration with Order service
  }

  async updateCatalog(orgId: string, catalogUpdate: any) {
    // Integrate with catalog.service.ts methods for advanced catalog logic
    return {}; // Placeholder for integration with Catalog service
  }

  async addPlant(orgId: string, plant: { name: string; pin: string; address: string }) {
    // You would call the appropriate update on the catalog for plants
    // e.g., this.catalogService.addPlant(orgId, plant);
  }
}
