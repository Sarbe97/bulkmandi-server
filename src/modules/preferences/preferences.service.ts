import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BuyerPreference, BuyerPreferenceDocument } from './schemas/buyer-preference.schema';
import { SellerPreference, SellerPreferenceDocument } from './schemas/seller-preference.schema';
import { LogisticPreference, LogisticPreferenceDocument } from './schemas/logistic-preference.schema';
import { UpdateBuyerPreferenceDto, UpdateLogisticPreferenceDto, UpdateSellerPreferenceDto } from './dto/preference.dto';

@Injectable()
export class PreferencesService {
  constructor(
    @InjectModel(BuyerPreference.name) private buyerModel: Model<BuyerPreferenceDocument>,
    @InjectModel(SellerPreference.name) private sellerModel: Model<SellerPreferenceDocument>,
    @InjectModel(LogisticPreference.name) private logisticModel: Model<LogisticPreferenceDocument>,
  ) {}

  async getPreferences(organizationId: string | Types.ObjectId, role: string) {
    if (role === 'BUYER') return this.buyerModel.findOne({ organizationId }).exec();
    if (role === 'SELLER') return this.sellerModel.findOne({ organizationId }).exec();
    if (role === 'LOGISTIC') return this.logisticModel.findOne({ organizationId }).exec();
    return null;
  }

  async upsertBuyerPreference(organizationId: string | Types.ObjectId, dto: UpdateBuyerPreferenceDto) {
    return this.buyerModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true }
    ).exec();
  }

  async upsertSellerPreference(organizationId: string | Types.ObjectId, dto: UpdateSellerPreferenceDto) {
    return this.sellerModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true }
    ).exec();
  }

  async upsertLogisticPreference(organizationId: string | Types.ObjectId, dto: UpdateLogisticPreferenceDto) {
    return this.logisticModel.findOneAndUpdate(
      { organizationId },
      { $set: dto },
      { new: true, upsert: true }
    ).exec();
  }
}
