import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { Quote, QuoteDocument } from './schemas/quote.schema';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>
  ) { }

  async findByRfqId(rfqId: string) {
    return this.quoteModel.find({ rfqId }).sort({ submittedAt: 1 });
  }

  async create(sellerId: string, dto: CreateQuoteDto) {
    // Find RFQ by custom string ID
    const rfq = await this.rfqModel.findOne({ rfqId: dto.rfqId });
    if (!rfq || rfq.status !== 'OPEN') throw new BadRequestException('RFQ not open for quoting');

    const exists = await this.quoteModel.findOne({ rfqId: dto.rfqId, sellerId });
    if (exists) throw new BadRequestException('Already quoted on this RFQ');

    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;
    const quoteId = `QUOTE-${Date.now()}`;
    const validityExpiresAt = new Date(Date.now() + dto.validityHours * 60 * 60 * 1000);

    const quote = new this.quoteModel({
      quoteId,
      rfqId: dto.rfqId, // Store string ID
      sellerId,
      sellerOrgName: "Seller Org", // TODO: Fetch actua org name
      pricePerMT: dto.pricePerMT,
      quantityMT: dto.quantityMT,
      freightPerMT: dto.freightPerMT,
      totalFreight: freightTotal,
      totalPriceBase: baseAmount,
      grandTotal,
      leadDays: dto.leadDays,
      validityHours: dto.validityHours,
      validityExpiresAt,
      notes: dto.notes || '',
      status: 'ACTIVE',
      submittedAt: new Date()
    });
    return quote.save();
  }

  async findBySellerId(sellerId: string, filter: Record<string, any> = {}, page = 1, limit = 20) {
    return this.quoteModel
      .find({ sellerId, ...filter })
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findByIdOrFail(id: string) {
    const quote = await this.quoteModel.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async accept(id: string, buyerId: string) {
    // Confirm buyer owns the corresponding RFQ, update status, create order, etc.
    const quote = await this.quoteModel.findById(id);
    if (!quote) throw new NotFoundException('Quote not found');
    quote.status = 'ACCEPTED';
    quote.acceptedAt = new Date();
    return quote.save();
  }

  async withdraw(id: string, sellerId: string) {
    const quote = await this.quoteModel.findById(id);
    if (!quote || quote.sellerId.toString() !== sellerId) throw new NotFoundException('Quote not found');
    quote.status = 'WITHDRAWN';
    return quote.save();
  }
}
