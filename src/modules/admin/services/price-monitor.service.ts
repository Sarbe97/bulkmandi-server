import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PriceIndex, PriceIndexDocument } from '../schemas/price-index.schema';

@Injectable()
export class PriceMonitorService {
  constructor(
    @InjectModel(PriceIndex.name) private priceIndexModel: Model<PriceIndexDocument>,
  ) {}

  async getPriceIndices(filters: any) {
    const query = {};
    if (filters.productCategory) query['productCategory'] = filters.productCategory;
    if (filters.productGrade) query['productGrade'] = filters.productGrade;
    if (filters.pin) query['pin'] = filters.pin;
    return this.priceIndexModel.find(query).sort({ lastUpdatedAt: -1 }).limit(100);
  }
}
