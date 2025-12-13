import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { Rfq, RfqDocument } from './schemas/rfq.schema';



@Injectable()
export class RfqService {
  constructor(
    @InjectModel(Rfq.name)
    private rfqModel: Model<RfqDocument>
  ) { }

  async create(buyerId: string, dto: CreateRfqDto) {
    // Make sure buyer org exists, skip for brevity
    const rfqId = `RFQ-${Date.now()}`;
    const rfq = new this.rfqModel({
      rfqId,
      buyerId,
      buyerOrgName: dto.buyerOrgName,
      product: {
        category: dto.category,
        grade: dto.grade,
        subCategory: dto.subCategory,
        size: dto.size,
        tolerance: dto.tolerance,
        millTcRequired: dto.millTcRequired || false,
      },
      quantityMT: dto.quantityMT,
      targetPin: dto.targetPin,
      deliveryBy: new Date(dto.deliveryBy),
      incoterm: dto.incoterm,
      notes: dto.notes,
      status: dto.status || 'OPEN'



    });
    return rfq.save();
  }

  async publish(id: string, buyerId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');
    rfq.status = 'OPEN';
    rfq.publishedAt = new Date();
    return rfq.save();
  }

  async findByBuyerId(buyerId: string, filters: Record<string, any> = {}, page = 1, limit = 20) {
    // Remove undefined values from filters
    const validFilters = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== undefined && v !== null && v !== ''));
    return this.rfqModel.find({ buyerId, ...validFilters }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }


  async findOpenRFQs(filters: Record<string, any> = {}, page = 1, limit = 20) {
    return this.rfqModel.find({ status: 'OPEN', ...filters }).skip((page - 1) * limit).limit(limit).sort({ publishedAt: -1 });
  }

  async findByIdOrFail(id: string) {
    let rfq;
    console.log(`[RfqService] Looking up RFQ with ID: ${id}`);

    // Check if valid ObjectId
    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      console.log(`[RfqService] ID is ObjectId`);
      rfq = await this.rfqModel.findById(id);
    }

    // If not found by _id, try finding by rfqId
    if (!rfq) {
      console.log(`[RfqService] Searching by rfqId: ${id}`);
      rfq = await this.rfqModel.findOne({ rfqId: id });
    }

    if (!rfq) {
      console.error(`[RfqService] RFQ not found for ID: ${id}`);
      throw new NotFoundException('RFQ not found');
    }
    console.log(`[RfqService] RFQ found: ${rfq._id}`);
    return rfq;
  }

  async close(id: string, buyerId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');
    rfq.status = 'CLOSED';
    return rfq.save();
  }

  async update(id: string, buyerId: string, dto: CreateRfqDto) {
    const rfq = await this.findByIdOrFail(id);
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');
    if (rfq.status !== 'DRAFT') throw new BadRequestException('Only drafts can be edited');

    rfq.buyerOrgName = dto.buyerOrgName;
    rfq.product = {
      category: dto.category,
      grade: dto.grade,
      subCategory: dto.subCategory,
      size: dto.size,
      tolerance: dto.tolerance,
      millTcRequired: dto.millTcRequired || false,
    };
    rfq.quantityMT = dto.quantityMT;
    rfq.targetPin = dto.targetPin;
    rfq.deliveryBy = new Date(dto.deliveryBy);
    rfq.incoterm = dto.incoterm;
    rfq.notes = dto.notes;
    // Allow status update (e.g. Save as Draft -> Publish)
    if (dto.status) rfq.status = dto.status;
    if (rfq.status === 'OPEN' && !rfq.publishedAt) rfq.publishedAt = new Date();

    return rfq.save();
  }

  // You may add auto-matching logic, seller suggestion, etc.

}
