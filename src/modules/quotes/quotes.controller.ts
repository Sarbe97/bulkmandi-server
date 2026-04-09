import {
  Body,
  Controller, Get,
  Param,
  Post, Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from 'src/common/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AcceptQuoteDto } from './dto/accept-quote.dto';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { QuotesService } from './quotes.service';
import { KycGuard } from 'src/common/guards/kyc.guard';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';

@ApiTags('Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(
    private readonly quotesService: QuotesService,
    private readonly logger: CustomLoggerService,
  ) { }

  @ApiOperation({ summary: 'Submit quote for RFQ (Seller only)' })
  @Roles(UserRole.SELLER)
  @UseGuards(KycGuard)
  @Post()
  async submitQuote(@CurrentUser() user: any, @Body() dto: CreateQuoteDto) {
    this.logger.log(`Quote submission request from seller: ${user.organizationId} for RFQ: ${dto.rfqId}`);
    return this.quotesService.create(user.organizationId, dto);
  }

  @ApiOperation({ summary: 'Get my quotes (Seller)' })
  @Roles(UserRole.SELLER)
  @Get('my-quotes')
  async getMyQuotes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('rfqId') rfqId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    const filter: any = {};
    if (status) filter.status = status;
    if (rfqId) filter.rfqId = rfqId;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);

    return this.quotesService.findBySellerId(user.organizationId, filter, pageNum, limitNum);
  }


  @ApiOperation({ summary: 'Get quotes for RFQ (Buyer)' })
  @Roles(UserRole.BUYER)
  @Get('rfq/:rfqId')
  async getQuotesForRFQ(
    @Param('rfqId') rfqId: string,
  ) {
    return this.quotesService.findByRfqId(rfqId);
  }

  @ApiOperation({ summary: 'Get quote by ID' })
  @Get('by-id/:id')
  async getQuoteById(@Param('id') id: string) {
    return this.quotesService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Accept quote (Buyer only)' })
  @Roles(UserRole.BUYER)
  @UseGuards(KycGuard)
  @Post(':id/accept')
  async acceptQuote(
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    this.logger.log(`Quote acceptance request for ID: ${id} from buyer: ${user.organizationId}`);
    return this.quotesService.accept(id, user.organizationId);
  }

  @ApiOperation({ summary: 'Withdraw quote (Seller)' })
  @Roles(UserRole.SELLER)
  @UseGuards(KycGuard)
  @Put(':id/withdraw')
  async withdrawQuote(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotesService.withdraw(id, user.organizationId);
  }
  @ApiOperation({ summary: 'Update quote (Seller)' })
  @Roles(UserRole.SELLER)
  @UseGuards(KycGuard)
  @Put(':id')
  async updateQuote(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: CreateQuoteDto
  ) {
    return this.quotesService.update(id, user.organizationId, dto);
  }
}
