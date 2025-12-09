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

      const defaultCategories = [
        { name: "HR Coils", grades: ["IS 2062 E250", "IS 2062 E350", "IS 2062 E500"] },
        { name: "TMT Bars", grades: ["Fe500", "Fe500D", "Fe550"] },
        { name: "Plates", grades: ["Mild Steel", "High Strength", "Stainless Steel"] },
        { name: "Structural", grades: ["IPN", "IPE", "ISMB", "ISJB"] },
      ];

      await this.masterDataModel.create({ fleetTypes: defaultFleets, productCategories: defaultCategories });
    } else {
      // Seed categories if missing in existing doc
      if (!exists.productCategories || exists.productCategories.length === 0) {
        exists.productCategories = [
          { name: "HR Coils", grades: ["IS 2062 E250", "IS 2062 E350", "IS 2062 E500"] },
          { name: "TMT Bars", grades: ["Fe500", "Fe500D", "Fe550"] },
          { name: "Plates", grades: ["Mild Steel", "High Strength", "Stainless Steel"] },
          { name: "Structural", grades: ["IPN", "IPE", "ISMB", "ISJB"] },
        ];
        await exists.save();
      }
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

  async deleteFleetType(type: string) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      data.fleetTypes = data.fleetTypes.filter(ft => ft.type !== type);
      await data.save();
      return data.fleetTypes;
    }
    return [];
  }

  async getProductCategories() {
    const data = await this.masterDataModel.findOne().select('productCategories');
    return data ? data.productCategories : [];
  }

  async addProductCategory(name: string, grades: string[]) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      const exists = data.productCategories.some(c => c.name === name);
      if (!exists) {
        data.productCategories.push({ name, grades });
        await data.save();
      }
      return data.productCategories;
    } else {
      return this.masterDataModel.create({ productCategories: [{ name, grades }] });
    }
  }

  async updateProductCategory(name: string, grades: string[]) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      const cat = data.productCategories.find(c => c.name === name);
      if (cat) {
        cat.grades = grades;
        await data.save();
      }
      return data.productCategories;
    }
    return [];
  }

  async deleteProductCategory(name: string) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      data.productCategories = data.productCategories.filter(c => c.name !== name);
      await data.save();
      return data.productCategories;
    }
    return [];
  }
}
