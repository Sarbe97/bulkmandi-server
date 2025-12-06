import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MasterData, MasterDataDocument } from './schema/master-data.schema';

@Injectable()
export class MasterDataService implements OnModuleInit {
  constructor(
    @InjectModel(MasterData.name) private masterDataModel: Model<MasterDataDocument>,
  ) { }

  async onModuleInit() {
    // Initialize default fleet types if not present
    const exists = await this.masterDataModel.findOne();
    if (!exists) {
      const defaultFleets = [
        { type: "20t_open", label: "20 t Open" },
        { type: "25t_trailer", label: "25 t Trailer" },
        { type: "covered_16t", label: "Covered 16 t" },
      ];
      await this.masterDataModel.create({ fleetTypes: defaultFleets });
    }
  }

  async getFleetTypes() {
    const data = await this.masterDataModel.findOne().select('fleetTypes');
    return data ? data.fleetTypes : [];
  }

  async addFleetType(type: string, label: string) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      // Check if exists
      const exists = data.fleetTypes.some(ft => ft.type === type);
      if (!exists) {
        data.fleetTypes.push({ type, label });
        await data.save();
      }
      return data.fleetTypes;
    } else {
      return this.masterDataModel.create({ fleetTypes: [{ type, label }] });
    }
  }
}
