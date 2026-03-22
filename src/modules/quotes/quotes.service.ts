import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { OrdersService } from '../orders/orders.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { QuoteStatus } from 'src/common/constants/app.constants';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @Inject(forwardRef(() => OrdersService)) private ordersService: OrdersService,
    private readonly orgService: OrganizationsService,
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

    // Fetch actual seller organization name
    let sellerOrgName = 'Unknown Seller';
    try {
      const sellerOrg = await this.orgService.getOrganization(sellerId);
      sellerOrgName = sellerOrg.legalName || sellerOrgName;
    } catch {
      // Fallback if org lookup fails
    }

    const quote = new this.quoteModel({
      quoteId,
      rfqId: dto.rfqId, // Store string ID
      sellerId,
      sellerOrgName,
      pricePerMT: dto.pricePerMT,
      quantityMT: dto.quantityMT,
      freightPerMT: dto.freightPerMT,
      totalFreight: freightTotal,
      totalPriceBase: baseAmount,
      grandTotal,
      currency: 'INR',
      leadDays: dto.leadDays,
      validityHours: dto.validityHours,
      validityExpiresAt,
      paymentTerms: dto.paymentTerms || '',
      notes: dto.notes || '',
      status: QuoteStatus.SUBMITTED,
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
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');
    return quote;
  }

  async accept(id: string, buyerId: string) {
    // Confirm buyer owns the corresponding RFQ, update status, create order, etc.
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== QuoteStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED quotes can be accepted');
    }

    const rfqCheck = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfqCheck && rfqCheck.status === 'WON') {
      throw new BadRequestException('This RFQ has already been awarded to another seller');
    }

    // 1. Create Order
    console.log(`[QuotesService] Accepting quote ${id}, creating order for buyer ${buyerId}`);
    const order = await this.ordersService.createFromQuote(quote, buyerId);
    console.log(`[QuotesService] Order created: ${order.orderId}`);

    // 2. Update Quote Status
    quote.status = QuoteStatus.ACCEPTED;
    quote.acceptedAt = new Date();
    quote.acceptedBy = buyerId;
    quote.orderId = order._id as any; // ✅ Link Order to Quote

    // 3. Update RFQ Status
    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfq) {
      rfq.status = 'WON';
      rfq.wonOrderId = order._id as any;
      await rfq.save();
    }

    return quote.save();
  }

  async withdraw(id: string, sellerId: string) {
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote || quote.sellerId.toString() !== sellerId) throw new NotFoundException('Quote not found');
    quote.status = QuoteStatus.WITHDRAWN;
    return quote.save();
  }

  async update(id: string, sellerId: string, dto: CreateQuoteDto) {
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.sellerId.toString() !== sellerId) throw new NotFoundException('Quote not found');

    if (quote.status === QuoteStatus.ACCEPTED || quote.status === QuoteStatus.REJECTED) {
      throw new BadRequestException(`Cannot update quote in ${quote.status} status`);
    }

    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;
    const validityExpiresAt = new Date(Date.now() + dto.validityHours * 60 * 60 * 1000);

    quote.pricePerMT = dto.pricePerMT;
    quote.quantityMT = dto.quantityMT;
    quote.freightPerMT = dto.freightPerMT;
    quote.totalFreight = freightTotal;
    quote.totalPriceBase = baseAmount;
    quote.grandTotal = grandTotal;
    quote.leadDays = dto.leadDays;
    quote.validityHours = dto.validityHours;
    quote.validityExpiresAt = validityExpiresAt;
    quote.paymentTerms = dto.paymentTerms;
    quote.notes = dto.notes || '';

    // Reset status to SUBMITTED if it was withdrawn or expired, or keep it SUBMITTED
    quote.status = QuoteStatus.SUBMITTED;
    quote.submittedAt = new Date(); // Update submission time

    return quote.save();
  }
}
