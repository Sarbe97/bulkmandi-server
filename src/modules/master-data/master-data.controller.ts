import { Body, Controller, Get, Post } from '@nestjs/common';
import { MasterDataService } from './master-data.service';

@Controller('master-data')
export class MasterDataController {
  constructor(private readonly masterDataService: MasterDataService) { }

  @Get('fleet-types')
  async getFleetTypes() {
    return this.masterDataService.getFleetTypes();
  }

  @Post('fleet-types')
  async addFleetType(@Body() body: { type: string; label: string }) {
    return this.masterDataService.addFleetType(body.type, body.label);
  }

  @Get('product-categories')
  async getProductCategories() {
    return this.masterDataService.getProductCategories();
  }

  @Post('product-categories')
  async addProductCategory(@Body() body: { name: string; grades: string[] }) {
    return this.masterDataService.addProductCategory(body.name, body.grades);
  }

  @Post('delete/fleet-types')
  async deleteFleetType(@Body() body: { type: string }) {
    return this.masterDataService.deleteFleetType(body.type);
  }

  @Post('delete/product-categories')
  async deleteProductCategory(@Body() body: { name: string }) {
    return this.masterDataService.deleteProductCategory(body.name);
  }


}
