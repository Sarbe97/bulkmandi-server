import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Negotiation, NegotiationDocument } from './schemas/negotiation.schema';
import { Quote, QuoteDocument } from '../quotes/schemas/quote.schema';
import { Rfq, RfqDocument } from '../rfq/schemas/rfq.schema';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuditService } from '../audit/audit.service';
import { CreateNegotiationDto } from './dto/create-negotiation.dto';
import { RespondNegotiationDto } from './dto/respond-negotiation.dto';
import { AuditAction, AuditModule, AuditEntityType } from 'src/common/constants/app.constants';
import { QuoteStatus, RfqStatus } from 'src/common/enums';
import { IdGeneratorService } from 'src/common/services/id-generator.service';

export enum NegotiationStatus {
  BUYER_COUNTERED = 'BUYER_COUNTERED',
  SELLER_COUNTERED = 'SELLER_COUNTERED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  EXPIRED = 'EXPIRED',
}

@Injectable()
export class NegotiationsService {
  constructor(
    @InjectModel(Negotiation.name) private negotiationModel: Model<NegotiationDocument>,
    @InjectModel(Quote.name) private quoteModel: Model<QuoteDocument>,
    @InjectModel(Rfq.name) private rfqModel: Model<RfqDocument>,
    private readonly orgService: OrganizationsService,
    private readonly auditService: AuditService,
    private readonly idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) {}

  // ───────────────────────────────────────────────────────────────
  // 1. Buyer initiates negotiation with counter-offer
  // ───────────────────────────────────────────────────────────────
  async initiate(buyerOrgId: string, dto: CreateNegotiationDto) {
    this.logger.log(`Initiating negotiation for quote: ${dto.quoteId} by buyer: ${buyerOrgId}`);
    const quote = await this.quoteModel.findOne({ quoteId: dto.quoteId });
    if (!quote) throw new NotFoundException('Quote not found');

    // Guard: only SUBMITTED or NEGOTIATING quotes can be negotiated
    if (![QuoteStatus.SUBMITTED, QuoteStatus.NEGOTIATING].includes(quote.status as QuoteStatus)) {
      throw new BadRequestException(`Cannot negotiate a quote in ${quote.status} status`);
    }

    // Guard: RFQ must still be open
    const rfq = await this.rfqModel.findOne({ rfqId: quote.rfqId });
    if (!rfq || ![RfqStatus.OPEN].includes(rfq.status as RfqStatus)) {
      throw new BadRequestException('RFQ is no longer open for negotiation');
    }

    // Guard: no duplicate active negotiation
    const existing = await this.negotiationModel.findOne({
      quoteId: dto.quoteId,
      status: { $in: [NegotiationStatus.BUYER_COUNTERED, NegotiationStatus.SELLER_COUNTERED] },
    });
    if (existing) {
      throw new BadRequestException('An active negotiation already exists for this quote');
    }

    // Resolve org names
    let buyerOrgName = 'Unknown Buyer';
    let orgCode: string | undefined;
    try {
      const buyerOrg = await this.orgService.getOrganization(buyerOrgId);
      buyerOrgName = buyerOrg.legalName || buyerOrgName;
      orgCode = buyerOrg.orgCode;
    } catch {}

    const negotiationId = this.idGenerator.generateBusinessId('NEG', orgCode);

    const negotiation = new this.negotiationModel({
      negotiationId,
      quoteId: quote.quoteId,
      rfqId: quote.rfqId,
      buyerId: new Types.ObjectId(buyerOrgId),
      buyerOrgName,
      sellerId: quote.sellerId,
      sellerOrgName: quote.sellerOrgName,
      status: NegotiationStatus.BUYER_COUNTERED,
      currentRound: 1,
      maxRounds: 5,
      rounds: [
        {
          roundNumber: 1,
          actor: 'BUYER',
          actorOrgId: new Types.ObjectId(buyerOrgId),
          pricePerMT: dto.pricePerMT,
          freightPerMT: dto.freightPerMT,
          quantityMT: dto.quantityMT,
          leadDays: dto.leadDays,
          paymentTerms: dto.paymentTerms || '',
          notes: dto.notes || '',
          createdAt: new Date(),
        },
      ],
    });

    const saved = await negotiation.save();

    // Update quote status to NEGOTIATING
    quote.status = QuoteStatus.NEGOTIATING;
    await quote.save();

    this.auditService.log({
      action: AuditAction.NEGOTIATION_INITIATED,
      module: AuditModule.NEGOTIATION,
      entityType: AuditEntityType.NEGOTIATION,
      entityId: saved._id as any,
      entityIdStr: saved.negotiationId,
      actorId: buyerOrgId,
      afterState: {
        negotiationId: saved.negotiationId,
        quoteId: dto.quoteId,
        buyerOffer: dto.pricePerMT,
        originalPrice: quote.pricePerMT,
      },
      description: `Buyer ${buyerOrgName} initiated negotiation on quote ${dto.quoteId} — counter ₹${dto.pricePerMT}/MT vs original ₹${quote.pricePerMT}/MT`,
    });

    return saved;
  }

  // ───────────────────────────────────────────────────────────────
  // 2. Either party responds with a counter-offer
  // ───────────────────────────────────────────────────────────────
  async respond(orgId: string, negotiationId: string, dto: RespondNegotiationDto) {
    this.logger.log(`Negotiation response/counter for: ${negotiationId} from org: ${orgId}`);
    const neg = await this.negotiationModel.findOne({ negotiationId });
    if (!neg) throw new NotFoundException('Negotiation not found');

    // Guard: must be in active state
    if (![NegotiationStatus.BUYER_COUNTERED, NegotiationStatus.SELLER_COUNTERED].includes(neg.status as NegotiationStatus)) {
      throw new BadRequestException(`Negotiation is ${neg.status} — cannot respond`);
    }

    // Guard: max rounds
    if (neg.currentRound >= neg.maxRounds) {
      throw new BadRequestException(`Maximum ${neg.maxRounds} rounds reached. Please accept, reject, or start a new negotiation.`);
    }

    // Determine whose turn it is
    const isBuyer = neg.buyerId.toString() === orgId;
    const isSeller = neg.sellerId.toString() === orgId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not a party to this negotiation');
    }

    // Turn validation
    if (neg.status === NegotiationStatus.BUYER_COUNTERED && isBuyer) {
      throw new BadRequestException('Waiting for seller response — it is not your turn');
    }
    if (neg.status === NegotiationStatus.SELLER_COUNTERED && isSeller) {
      throw new BadRequestException('Waiting for buyer response — it is not your turn');
    }

    const nextRound = neg.currentRound + 1;
    const actor = isBuyer ? 'BUYER' : 'SELLER';

    neg.rounds.push({
      roundNumber: nextRound,
      actor,
      actorOrgId: new Types.ObjectId(orgId),
      pricePerMT: dto.pricePerMT,
      freightPerMT: dto.freightPerMT,
      quantityMT: dto.quantityMT,
      leadDays: dto.leadDays,
      paymentTerms: dto.paymentTerms || '',
      notes: dto.notes || '',
      createdAt: new Date(),
    });

    neg.currentRound = nextRound;
    neg.status = isBuyer ? NegotiationStatus.BUYER_COUNTERED : NegotiationStatus.SELLER_COUNTERED;

    const saved = await neg.save();

    this.auditService.log({
      action: AuditAction.NEGOTIATION_COUNTER,
      module: AuditModule.NEGOTIATION,
      entityType: AuditEntityType.NEGOTIATION,
      entityId: saved._id as any,
      entityIdStr: saved.negotiationId,
      actorId: orgId,
      afterState: { round: nextRound, actor, pricePerMT: dto.pricePerMT },
      description: `${actor} countered in round ${nextRound} — ₹${dto.pricePerMT}/MT`,
    });

    return saved;
  }

  // ───────────────────────────────────────────────────────────────
  // 3. Accept the latest offer
  // ───────────────────────────────────────────────────────────────
  async accept(orgId: string, negotiationId: string) {
    this.logger.log(`Negotiation acceptance for: ${negotiationId} by org: ${orgId}`);
    const neg = await this.negotiationModel.findOne({ negotiationId });
    if (!neg) throw new NotFoundException('Negotiation not found');

    if (![NegotiationStatus.BUYER_COUNTERED, NegotiationStatus.SELLER_COUNTERED].includes(neg.status as NegotiationStatus)) {
      throw new BadRequestException(`Negotiation is ${neg.status} — cannot accept`);
    }

    const isBuyer = neg.buyerId.toString() === orgId;
    const isSeller = neg.sellerId.toString() === orgId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not a party to this negotiation');
    }

    // Can only accept the OTHER party's offer (not your own)
    if (neg.status === NegotiationStatus.BUYER_COUNTERED && isBuyer) {
      throw new BadRequestException('You cannot accept your own offer — wait for seller response');
    }
    if (neg.status === NegotiationStatus.SELLER_COUNTERED && isSeller) {
      throw new BadRequestException('You cannot accept your own offer — wait for buyer response');
    }

    // Get the latest round's terms (the offer being accepted)
    const latestRound = neg.rounds[neg.rounds.length - 1];

    // Update negotiation status
    neg.status = NegotiationStatus.ACCEPTED;
    neg.acceptedAt = new Date();
    await neg.save();

    // Update the quote with the negotiated terms
    const quote = await this.quoteModel.findOne({ quoteId: neg.quoteId });
    if (quote) {
      quote.pricePerMT = latestRound.pricePerMT;
      quote.freightPerMT = latestRound.freightPerMT;
      quote.quantityMT = latestRound.quantityMT;
      quote.leadDays = latestRound.leadDays;
      if (latestRound.paymentTerms) quote.paymentTerms = latestRound.paymentTerms;

      // Recalculate totals
      quote.totalPriceBase = latestRound.pricePerMT * latestRound.quantityMT;
      quote.totalFreight = latestRound.freightPerMT * latestRound.quantityMT;
      quote.grandTotal = quote.totalPriceBase + quote.totalFreight;

      // Return quote to SUBMITTED so buyer can accept it normally
      quote.status = QuoteStatus.SUBMITTED;
      quote.submittedAt = new Date();

      await quote.save();
    }

    this.auditService.log({
      action: AuditAction.NEGOTIATION_ACCEPTED,
      module: AuditModule.NEGOTIATION,
      entityType: AuditEntityType.NEGOTIATION,
      entityId: neg._id as any,
      entityIdStr: neg.negotiationId,
      actorId: orgId,
      afterState: {
        agreedPrice: latestRound.pricePerMT,
        agreedFreight: latestRound.freightPerMT,
        round: neg.currentRound,
      },
      description: `Negotiation ${neg.negotiationId} accepted at ₹${latestRound.pricePerMT}/MT after ${neg.currentRound} rounds`,
    });

    return neg;
  }

  // ───────────────────────────────────────────────────────────────
  // 4. Reject the negotiation
  // ───────────────────────────────────────────────────────────────
  async reject(orgId: string, negotiationId: string, reason?: string) {
    const neg = await this.negotiationModel.findOne({ negotiationId });
    if (!neg) throw new NotFoundException('Negotiation not found');

    if (![NegotiationStatus.BUYER_COUNTERED, NegotiationStatus.SELLER_COUNTERED].includes(neg.status as NegotiationStatus)) {
      throw new BadRequestException(`Negotiation is ${neg.status} — cannot reject`);
    }

    const isBuyer = neg.buyerId.toString() === orgId;
    const isSeller = neg.sellerId.toString() === orgId;

    if (!isBuyer && !isSeller) {
      throw new ForbiddenException('You are not a party to this negotiation');
    }

    neg.status = NegotiationStatus.REJECTED;
    neg.rejectedAt = new Date();
    neg.rejectionReason = reason || '';
    await neg.save();

    // Revert quote status back to SUBMITTED
    const quote = await this.quoteModel.findOne({ quoteId: neg.quoteId });
    if (quote && quote.status === QuoteStatus.NEGOTIATING) {
      quote.status = QuoteStatus.SUBMITTED;
      await quote.save();
    }

    this.auditService.log({
      action: AuditAction.NEGOTIATION_REJECTED,
      module: AuditModule.NEGOTIATION,
      entityType: AuditEntityType.NEGOTIATION,
      entityId: neg._id as any,
      entityIdStr: neg.negotiationId,
      actorId: orgId,
      afterState: { reason },
      description: `Negotiation ${neg.negotiationId} rejected${reason ? ': ' + reason : ''}`,
    });

    return neg;
  }

  // ───────────────────────────────────────────────────────────────
  // Query helpers
  // ───────────────────────────────────────────────────────────────
  async findByQuoteId(quoteId: string) {
    return this.negotiationModel
      .find({ quoteId })
      .sort({ createdAt: -1 });
  }

  async findLatestByQuoteId(quoteId: string) {
    return this.negotiationModel.findOne({
      quoteId,
    }).sort({ createdAt: -1 });
  }

  async findByRfqId(rfqId: string) {
    return this.negotiationModel
      .find({ rfqId })
      .sort({ createdAt: -1 });
  }

  async findById(negotiationId: string) {
    const neg = await this.negotiationModel.findOne({ negotiationId });
    if (!neg) throw new NotFoundException('Negotiation not found');
    return neg;
  }
}
