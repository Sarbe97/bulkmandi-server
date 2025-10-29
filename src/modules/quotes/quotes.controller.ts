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

@ApiTags('Quotes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('quotes')
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @ApiOperation({ summary: 'Submit quote for RFQ (Seller only)' })
  @Roles(UserRole.SELLER)
  @Post()
  async submitQuote(@CurrentUser() user: any, @Body() dto: CreateQuoteDto) {
    return this.quotesService.create(user.organizationId, dto);
  }

  @ApiOperation({ summary: 'Get my quotes (Seller)' })
  @Roles(UserRole.SELLER)
  @Get('me')
  async getMyQuotes(
    @CurrentUser() user: any,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.quotesService.findBySellerId(user.organizationId, { status }, page, limit);
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
  @Get(':id')
  async getQuoteById(@Param('id') id: string) {
    return this.quotesService.findByIdOrFail(id);
  }

  @ApiOperation({ summary: 'Accept quote (Buyer only)' })
  @Roles(UserRole.BUYER)
  @Put(':id/accept')
  async acceptQuote(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() acceptDto: AcceptQuoteDto,
  ) {
    return this.quotesService.accept(id, user.organizationId);
  }

  @ApiOperation({ summary: 'Withdraw quote (Seller)' })
  @Roles(UserRole.SELLER)
  @Put(':id/withdraw')
  async withdrawQuote(@CurrentUser() user: any, @Param('id') id: string) {
    return this.quotesService.withdraw(id, user.organizationId);
  }
}
