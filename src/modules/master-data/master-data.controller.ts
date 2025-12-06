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
}
