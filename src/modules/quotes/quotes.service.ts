import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { AuditService } from '../audit/audit.service';
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
    private readonly auditService: AuditService,
  ) {}

  async findByRfqId(rfqId: string) {
    return this.quoteModel.find({ rfqId }).sort({ submittedAt: 1 });
  }

  async create(sellerId: string, dto: CreateQuoteDto) {
    const rfq = await this.rfqModel.findOne({ rfqId: dto.rfqId });
    if (!rfq || rfq.status !== 'OPEN') throw new BadRequestException('RFQ not open for quoting');

    const exists = await this.quoteModel.findOne({ rfqId: dto.rfqId, sellerId, status: { $ne: QuoteStatus.WITHDRAWN } });
    if (exists) throw new BadRequestException('Already quoted on this RFQ');

    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;
    const quoteId = `QUOTE-${Date.now()}`;
    const validityExpiresAt = new Date(Date.now() + dto.validityHours * 60 * 60 * 1000);

    let sellerOrgName = 'Unknown Seller';
    try {
      const sellerOrg = await this.orgService.getOrganization(sellerId);
      sellerOrgName = sellerOrg.legalName || sellerOrgName;
    } catch {
      // Fallback if org lookup fails
    }

    const quote = new this.quoteModel({
      quoteId,
      rfqId: dto.rfqId,
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
      submittedAt: new Date(),
    });

    const savedQuote = await quote.save();

    rfq.quotesCount = (rfq.quotesCount || 0) + 1;
    await rfq.save();

    this.auditService.log({
      action: 'QUOTE_SUBMITTED',
      module: 'QUOTE',
      entityType: 'QUOTE',
      entityId: savedQuote._id as any,
      entityIdStr: savedQuote.quoteId,
      actorId: sellerId,
      afterState: { quoteId: savedQuote.quoteId, rfqId: dto.rfqId, grandTotal, status: QuoteStatus.SUBMITTED },
      description: `Quote ${savedQuote.quoteId} submitted by seller ${sellerOrgName} for RFQ ${dto.rfqId}`,
    });

    return savedQuote;
  }

  async findBySellerId(sellerId: string, filter: Record<string, any> = {}, page = 1, limit = 20) {
    return this.quoteModel
      .find({ sellerId, ...filter })
      .sort({ submittedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findAll(filter: Record<string, any> = {}, page = 1, limit = 20) {
    const validFilters = Object.fromEntries(Object.entries(filter).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.quoteModel
      .find(validFilters)
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
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== QuoteStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED quotes can be accepted');
    }

    const rfqCheck = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfqCheck && rfqCheck.status === 'WON') {
      throw new BadRequestException('This RFQ has already been awarded to another seller');
    }

    const order = await this.ordersService.createFromQuote(quote, buyerId);

    quote.status = QuoteStatus.ACCEPTED;
    quote.acceptedAt = new Date();
    quote.acceptedBy = buyerId;
    quote.orderId = order._id as any;

    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfq) {
      rfq.status = 'WON';
      rfq.wonOrderId = order._id as any;
      await rfq.save();
    }

    // Auto-reject competing quotes
    await this.quoteModel.updateMany(
      { rfqId: quote.rfqId, status: QuoteStatus.SUBMITTED, _id: { $ne: quote._id } },
      { $set: { status: QuoteStatus.REJECTED } }
    );

    const saved = await quote.save();

    this.auditService.log({
      action: 'QUOTE_ACCEPTED',
      module: 'QUOTE',
      entityType: 'QUOTE',
      entityId: saved._id as any,
      entityIdStr: saved.quoteId,
      actorId: buyerId,
      beforeState: { status: QuoteStatus.SUBMITTED },
      afterState: { status: QuoteStatus.ACCEPTED, orderId: order._id?.toString(), orderId_str: order.orderId },
      changedFields: ['status', 'acceptedAt', 'acceptedBy', 'orderId'],
      description: `Quote ${saved.quoteId} accepted → Order ${order.orderId} created`,
    });

    return saved;
  }

  async withdraw(id: string, sellerId: string) {
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote || quote.sellerId.toString() !== sellerId) throw new NotFoundException('Quote not found');

    const prevStatus = quote.status;
    quote.status = QuoteStatus.WITHDRAWN;
    const result = await quote.save();

    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfq) {
      rfq.quotesCount = Math.max(0, (rfq.quotesCount || 0) - 1);
      await rfq.save();
    }

    this.auditService.log({
      action: 'QUOTE_WITHDRAWN',
      module: 'QUOTE',
      entityType: 'QUOTE',
      entityId: result._id as any,
      entityIdStr: result.quoteId,
      actorId: sellerId,
      beforeState: { status: prevStatus },
      afterState: { status: QuoteStatus.WITHDRAWN },
      changedFields: ['status'],
      description: `Quote ${result.quoteId} withdrawn by seller ${sellerId}`,
    });

    return result;
  }

  async update(id: string, sellerId: string, dto: CreateQuoteDto) {
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.sellerId.toString() !== sellerId) throw new NotFoundException('Quote not found');

    if (quote.status === QuoteStatus.ACCEPTED || quote.status === QuoteStatus.REJECTED) {
      throw new BadRequestException(`Cannot update quote in ${quote.status} status`);
    }

    const prevGrandTotal = quote.grandTotal;
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
    quote.status = QuoteStatus.SUBMITTED;
    quote.submittedAt = new Date();

    const saved = await quote.save();

    this.auditService.log({
      action: 'QUOTE_UPDATED',
      module: 'QUOTE',
      entityType: 'QUOTE',
      entityId: saved._id as any,
      entityIdStr: saved.quoteId,
      actorId: sellerId,
      beforeState: { grandTotal: prevGrandTotal },
      afterState: { grandTotal, pricePerMT: dto.pricePerMT, quantityMT: dto.quantityMT },
      changedFields: ['pricePerMT', 'quantityMT', 'freightPerMT', 'grandTotal', 'leadDays', 'validityHours'],
      description: `Quote ${saved.quoteId} updated by seller ${sellerId}`,
    });

    return saved;
  }
}
