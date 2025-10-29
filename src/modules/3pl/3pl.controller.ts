import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ThreePLService } from './3pl.service';
import { AssignmentDto } from './dto/assignment.dto';

@ApiTags('3PL')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('3pl')
export class ThreePLController {
  constructor(private readonly threePLService: ThreePLService) {}

  @Roles(UserRole['3PL'])
  @Post('assign-shipment')
  async assignShipment(@Body() dto: AssignmentDto) {
    return this.threePLService.assignShipment(dto);
  }
}
