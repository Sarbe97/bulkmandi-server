import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { KycGuard } from 'src/common/guards/kyc.guard';
import { NegotiationsService } from './negotiations.service';
import { CreateNegotiationDto } from './dto/create-negotiation.dto';
import { RespondNegotiationDto } from './dto/respond-negotiation.dto';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@ApiTags('Negotiations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('negotiations')
export class NegotiationsController {
  constructor(
    private readonly negotiationsService: NegotiationsService,
    private readonly logger: CustomLoggerService,
  ) {}

  @ApiOperation({ summary: 'Initiate a negotiation (Buyer only)' })
  @Roles(UserRole.BUYER)
  @UseGuards(KycGuard)
  @Post()
  async initiateNegotiation(@CurrentUser() user: any, @Body() dto: CreateNegotiationDto) {
    this.logger.log(`Negotiation initiation request for quote: ${dto.quoteId} from buyer: ${user.organizationId}`);
    return this.negotiationsService.initiate(user.organizationId, dto);
  }

  @ApiOperation({ summary: 'Respond to a counter-offer (Buyer or Seller)' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @UseGuards(KycGuard)
  @Put(':id/respond')
  async respondToNegotiation(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: RespondNegotiationDto,
  ) {
    return this.negotiationsService.respond(user.organizationId, id, dto);
  }

  @ApiOperation({ summary: 'Accept the latest offer' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @UseGuards(KycGuard)
  @Put(':id/accept')
  async acceptNegotiation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.negotiationsService.accept(user.organizationId, id);
  }

  @ApiOperation({ summary: 'Reject and close negotiation' })
  @Roles(UserRole.BUYER, UserRole.SELLER)
  @UseGuards(KycGuard)
  @Put(':id/reject')
  async rejectNegotiation(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body('reason') reason?: string,
  ) {
    return this.negotiationsService.reject(user.organizationId, id, reason);
  }

  @ApiOperation({ summary: 'Get latest negotiation for a quote (active or closed)' })
  @Get('quote/:quoteId/latest')
  async getLatestNegotiationForQuote(@Param('quoteId') quoteId: string) {
    return this.negotiationsService.findLatestByQuoteId(quoteId);
  }

  @ApiOperation({ summary: 'Get all negotiations for a quote (history)' })
  @Get('quote/:quoteId')
  async getNegotiationsForQuote(@Param('quoteId') quoteId: string) {
    return this.negotiationsService.findByQuoteId(quoteId);
  }

  @ApiOperation({ summary: 'Get negotiations for an RFQ' })
  @Get('rfq/:rfqId')
  async getNegotiationsForRfq(@Param('rfqId') rfqId: string) {
    return this.negotiationsService.findByRfqId(rfqId);
  }

  @ApiOperation({ summary: 'Get negotiation by ID' })
  @Get(':id')
  async getNegotiationById(@Param('id') id: string) {
    return this.negotiationsService.findById(id);
  }
}
