import { BadRequestException, Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { AuditService } from '../audit/audit.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { Quote, QuoteDocument } from './schemas/quote.schema';
import { OrdersService } from '../orders/orders.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { MasterDataService } from '../master-data/master-data.service';
import { UsersService } from '../users/services/users.service';
import { RfqStatus, QuoteStatus } from 'src/common/enums';
import { AuditAction, AuditModule, AuditEntityType, LogisticsPreference } from 'src/common/constants/app.constants';

@Injectable()
export class QuotesService {
  constructor(
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    @Inject(forwardRef(() => OrdersService)) private ordersService: OrdersService,
    private readonly orgService: OrganizationsService,
    private readonly masterDataService: MasterDataService,
    private readonly auditService: AuditService,
    private readonly usersService: UsersService,
    private readonly logger: CustomLoggerService,
  ) {}

  async findByRfqId(rfqId: string) {
    return this.quoteModel.find({ rfqId }).sort({ submittedAt: 1 });
  }

  async create(sellerId: string, dto: CreateQuoteDto) {
    this.logger.log(`Creating new quote for RFQ: ${dto.rfqId} from seller: ${sellerId}`);
    const rfq = await this.rfqModel.findOne({ rfqId: dto.rfqId });
    if (!rfq || rfq.status !== RfqStatus.OPEN) throw new BadRequestException('RFQ not open for quoting');

    const exists = await this.quoteModel.findOne({ rfqId: dto.rfqId, sellerId, status: { $ne: QuoteStatus.WITHDRAWN } });
    if (exists) throw new BadRequestException('Already quoted on this RFQ');

    // 1. Enforce Logistics Mode
    if (rfq.logisticsPreference === LogisticsPreference.SELF_PICKUP) {
      this.logger.debug(`RFQ ${rfq.rfqId} is purely SELF_PICKUP (EXW). Forcing freight to 0 regardless of input.`);
      dto.freightPerMT = 0;
    }

    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;
    const pricePerMTLanded = (grandTotal / dto.quantityMT);

    // 2. Fetch Master Data Benchmark
    let benchmarkLandedPrice = 0;
    let benchmarkRef: { city: string; brand: string } | null = null;
    try {
      const benchmark = await this.masterDataService.getBenchmarkForRfq({
        category: rfq.product.category,
        grade: rfq.product.grade,
        city: rfq.targetCity,
      });
      if (benchmark) {
        benchmarkLandedPrice = benchmark.basePrice;
        benchmarkRef = { city: benchmark.city, brand: benchmark.brand };
        this.logger.debug(`Benchmark resolved for ${rfq.rfqId}: ₹${benchmarkLandedPrice}/MT from ${benchmark.city} (${benchmark.brand})`);
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve catalog benchmark for ${rfq.rfqId}: ${err.message}`);
    }

    // 3. Apply 3-Level Deviation Guardrails (thresholds from MasterData platform config)
    if (benchmarkLandedPrice > 0) {
      const deviation = (pricePerMTLanded / benchmarkLandedPrice) - 1;

      // Fetch live tolerances from DB (safe fallback to defaults if DB fails)
      const config = await this.masterDataService.getPlatformConfig().catch(() => null);
      const WARNING_TOLERANCE = config?.quoteDeviation?.warningThreshold ?? 0.4;
      const JUSTIFICATION_TOLERANCE = config?.quoteDeviation?.justificationThreshold ?? 1.0;
      const HARD_BLOCK_TOLERANCE = config?.quoteDeviation?.blockThreshold ?? 2.0;

      if (deviation > HARD_BLOCK_TOLERANCE) {
        throw new BadRequestException(`Price deviation exceeds the platform limit (+${(HARD_BLOCK_TOLERANCE * 100).toFixed(0)}% above benchmark). Benchmark: ₹${benchmarkLandedPrice}/MT. Your Landed Rate: ₹${pricePerMTLanded.toFixed(2)}/MT.`);
      }

      if (deviation > JUSTIFICATION_TOLERANCE && !dto.priceJustification) {
        throw new BadRequestException(`Price deviation is significantly higher (>${(JUSTIFICATION_TOLERANCE * 100).toFixed(0)}%) than the market benchmark. You must provide a Price Justification to submit this quote.`);
      }
    }

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
      rfqNumber: rfq.rfqId, // Store human readable RFQ #
      product: rfq.product.category, // Store product name
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
      priceJustification: dto.priceJustification || '',
      status: QuoteStatus.SUBMITTED,
      submittedAt: new Date(),
    });

    const savedQuote = await quote.save();

    rfq.quotesCount = (rfq.quotesCount || 0) + 1;
    await rfq.save();

    this.auditService.log({
      action: AuditAction.QUOTE_SUBMITTED,
      module: AuditModule.QUOTE,
      entityType: AuditEntityType.QUOTE,
      entityId: savedQuote._id as any,
      entityIdStr: savedQuote.quoteId,
      actorId: sellerId,
      afterState: { quoteId: savedQuote.quoteId, rfqId: dto.rfqId, grandTotal, status: QuoteStatus.SUBMITTED },
      description: `Quote ${savedQuote.quoteId} submitted by seller ${sellerOrgName} for RFQ ${dto.rfqId}`,
      targetOrgIds: [sellerId as any],
      targetUserIds: rfq.createdBy 
        ? [rfq.createdBy] 
        : (await this.usersService.findByOrgId(rfq.buyerId.toString())).map(u => (u as any)._id as any),
    });

    return savedQuote;
  }

  async findBySellerId(sellerId: string, filter: Record<string, any> = {}, page = 1, limit = 20) {
    this.logger.debug(`Fetching quotes for seller organization: ${sellerId} (page ${page}, limit ${limit})`);

    const skip = (page - 1) * limit;
    const match: Record<string, any> = { sellerId: new Types.ObjectId(sellerId) };
    
    // Merge additional filters if present
    if (filter && Object.keys(filter).length > 0) {
      Object.assign(match, filter);
    }

    // Use aggregation to join RFQ data for 100% data accuracy
    const quotes = await this.quoteModel.aggregate([
      { $match: match },
      { $sort: { submittedAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'rfqs',
          localField: 'rfqId',
          foreignField: 'rfqId',
          as: 'rfqContext',
        },
      },
      {
        $addFields: {
          rfq: { $arrayElemAt: ['$rfqContext', 0] },
        },
      },
      {
        $project: {
          _id: 1,
          quoteId: 1,
          rfqId: 1,
          sellerId: 1,
          sellerOrgName: 1,
          pricePerMT: 1,
          quantityMT: 1,
          freightPerMT: 1,
          totalFreight: 1,
          totalPriceBase: 1,
          grandTotal: 1,
          currency: 1,
          leadDays: 1,
          validityHours: 1,
          validityExpiresAt: 1,
          status: 1,
          submittedAt: 1,
          notes: 1,
          // Map joined fields
          rfqNumber: { $ifNull: ['$rfqNumber', '$rfq.rfqId'] },
          product: { 
            $ifNull: [
              '$product', 
              { $concat: ['$rfq.product.category', ' (', { $ifNull: ['$rfq.product.subCategory', 'N/A'] }, ', ', { $ifNull: ['$rfq.product.grade', 'N/A'] }, ')'] }
            ] 
          },
          buyer: '$rfq.buyerOrgName'
        },
      },
    ]);

    return { quotes };
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

    // Lazy-patch missing data for legacy quotes
    if (!quote.rfqNumber || !quote.product) {
      const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
      if (rfq) {
        quote.rfqNumber = rfq.rfqId;
        quote.product = rfq.product.category;
        await quote.save(); // Save the fix back to DB
      }
    }

    return quote;
  }

  async accept(id: string, buyerId: string) {
    this.logger.log(`Accepting quote: ${id} by buyer: ${buyerId}`);
    const quote = await this.quoteModel.findOne({ quoteId: id });
    if (!quote) throw new NotFoundException('Quote not found');

    if (quote.status !== QuoteStatus.SUBMITTED) {
      throw new BadRequestException('Only SUBMITTED quotes can be accepted');
    }

    const rfqCheck = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfqCheck && rfqCheck.status === RfqStatus.WON) {
      throw new BadRequestException('This RFQ has already been awarded to another seller');
    }

    const order = await this.ordersService.createFromQuote(quote, buyerId);

    quote.status = QuoteStatus.ACCEPTED;
    quote.acceptedAt = new Date();
    quote.acceptedBy = buyerId;
    quote.orderId = order._id as any;

    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (rfq) {
      rfq.status = RfqStatus.WON;
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
      action: AuditAction.QUOTE_ACCEPTED,
      module: AuditModule.QUOTE,
      entityType: AuditEntityType.QUOTE,
      entityId: saved._id as any,
      entityIdStr: saved.quoteId,
      actorId: buyerId,
      beforeState: { status: QuoteStatus.SUBMITTED },
      afterState: { status: QuoteStatus.ACCEPTED, orderId: order._id?.toString(), orderId_str: order.orderId },
      changedFields: ['status', 'acceptedAt', 'acceptedBy', 'orderId'],
      description: `Quote ${saved.quoteId} accepted → Order ${order.orderId} created`,
      targetOrgIds: [buyerId as any, saved.sellerId as any],
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
      action: AuditAction.QUOTE_WITHDRAWN,
      module: AuditModule.QUOTE,
      entityType: AuditEntityType.QUOTE,
      entityId: result._id as any,
      entityIdStr: result.quoteId,
      actorId: sellerId,
      beforeState: { status: prevStatus },
      afterState: { status: QuoteStatus.WITHDRAWN },
      changedFields: ['status'],
      description: `Quote ${result.quoteId} withdrawn by seller ${sellerId}`,
      targetOrgIds: [sellerId as any],
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

    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });

    if (rfq && rfq.logisticsPreference === LogisticsPreference.SELF_PICKUP) {
      this.logger.debug(`RFQ ${rfq.rfqId} is purely SELF_PICKUP (EXW). Forcing updated freight to 0 regardless of input.`);
      dto.freightPerMT = 0;
    }

    const prevGrandTotal = quote.grandTotal;
    const baseAmount = dto.pricePerMT * dto.quantityMT;
    const freightTotal = dto.freightPerMT * dto.quantityMT;
    const grandTotal = baseAmount + freightTotal;
    const pricePerMTLanded = (grandTotal / dto.quantityMT);
    const validityExpiresAt = new Date(Date.now() + dto.validityHours * 60 * 60 * 1000);

    // 2. Fetch Master Data Benchmark
    let benchmarkLandedPrice = 0;
    if (rfq) {
      try {
        const benchmark = await this.masterDataService.getBenchmarkForRfq({
          category: rfq.product.category,
          grade: rfq.product.grade,
          city: rfq.targetCity,
        });
        if (benchmark) {
          benchmarkLandedPrice = benchmark.basePrice;
          this.logger.debug(`Update benchmark resolved: ₹${benchmarkLandedPrice}/MT from ${benchmark.city}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve catalog benchmark for ${rfq.rfqId}: ${err.message}`);
      }
    }

    // 3. Apply 3-Level Deviation Guardrails (thresholds from MasterData platform config)
    if (benchmarkLandedPrice > 0) {
      const deviation = (pricePerMTLanded / benchmarkLandedPrice) - 1;

      const config = await this.masterDataService.getPlatformConfig().catch(() => null);
      const JUSTIFICATION_TOLERANCE = config?.quoteDeviation?.justificationThreshold ?? 1.0;
      const HARD_BLOCK_TOLERANCE = config?.quoteDeviation?.blockThreshold ?? 2.0;

      if (deviation > HARD_BLOCK_TOLERANCE) {
        throw new BadRequestException(`Price deviation exceeds the platform limit (+${(HARD_BLOCK_TOLERANCE * 100).toFixed(0)}% above benchmark). Benchmark: ₹${benchmarkLandedPrice}/MT. Your Landed Rate: ₹${pricePerMTLanded.toFixed(2)}/MT.`);
      }

      if (deviation > JUSTIFICATION_TOLERANCE && !dto.priceJustification) {
        throw new BadRequestException(`Price deviation is significantly higher (>${(JUSTIFICATION_TOLERANCE * 100).toFixed(0)}%) than the market benchmark. You must provide a Price Justification to update this quote.`);
      }
    }

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
    quote.priceJustification = dto.priceJustification || '';
    quote.status = QuoteStatus.SUBMITTED;
    quote.submittedAt = new Date();

    const saved = await quote.save();

    this.auditService.log({
      action: AuditAction.QUOTE_UPDATED,
      module: AuditModule.QUOTE,
      entityType: AuditEntityType.QUOTE,
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
