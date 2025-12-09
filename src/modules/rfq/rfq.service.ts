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
      status: 'OPEN'

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
    return this.rfqModel.find({ buyerId, ...filters }).skip((page - 1) * limit).limit(limit).sort({ createdAt: -1 });
  }

  async findOpenRFQs(filters: Record<string, any> = {}, page = 1, limit = 20) {
    return this.rfqModel.find({ status: 'OPEN', ...filters }).skip((page - 1) * limit).limit(limit).sort({ publishedAt: -1 });
  }

  async findByIdOrFail(id: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    return rfq;
  }

  async close(id: string, buyerId: string) {
    const rfq = await this.rfqModel.findById(id);
    if (!rfq) throw new NotFoundException('RFQ not found');
    if (rfq.buyerId.toString() !== buyerId.toString()) throw new BadRequestException('Unauthorized');
    rfq.status = 'CLOSED';
    return rfq.save();
  }

  // You may add auto-matching logic, seller suggestion, etc.
}
