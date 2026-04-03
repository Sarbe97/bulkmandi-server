import {
  Body, Controller, Delete, Get, Param, Post, Put, Query,
} from '@nestjs/common';
import { CustomLoggerService } from 'src/core/logger/custom.logger.service';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { MasterDataService } from './master-data.service';
import {
  CreateCatalogItemDto, UpdateCatalogItemDto,
  CreateCatalogListingDto, UpdateCatalogListingDto,
} from './dto/catalog-data.dto';

@ApiTags('Master Data')
@Controller('master-data')
export class MasterDataController {
  constructor(
    private readonly masterDataService: MasterDataService,
    private readonly logger: CustomLoggerService,
  ) {}

  // ══════════════════════════════════════════
  //  LEGACY – Fleet Types & Product Categories
  // ══════════════════════════════════════════

  @Get('fleet-types')
  async getFleetTypes() {
    return this.masterDataService.getFleetTypes();
  }

  @Post('fleet-types')
  async addFleetType(@Body() body: { type: string; label: string }) {
    return this.masterDataService.addFleetType(body.type, body.label);
  }

  @Post('delete/fleet-types')
  async deleteFleetType(@Body() body: { type: string }) {
    return this.masterDataService.deleteFleetType(body.type);
  }

  @Get('product-categories')
  async getProductCategories() {
    return this.masterDataService.getProductCategories();
  }

  @ApiOperation({ summary: 'Get Platform Escrow Account details' })
  @Get('escrow-account')
  async getEscrowAccount() {
    return this.masterDataService.getEscrowAccount();
  }

  @ApiOperation({ summary: 'Update Platform Escrow Account details (Admin)' })
  @Post('escrow-account')
  async updateEscrowAccount(@Body() body: any) {
    this.logger.log('Updating platform escrow account details');
    return this.masterDataService.updateEscrowAccount(body);
  }

  // ══════════════════════════════════════════
  //  CATALOG ITEMS
  // ══════════════════════════════════════════

  @ApiOperation({ summary: 'Get all catalog items, optionally filtered by subcategory' })
  @ApiQuery({ name: 'subcategory', required: false })
  @Get('catalog-items')
  async getAllCatalogItems(@Query('subcategory') subcategory?: string) {
    return this.masterDataService.getAllCatalogItems(subcategory);
  }

  @ApiOperation({ summary: 'Get distinct product subcategories' })
  @Get('catalog-items/subcategories')
  async getSubcategories() {
    return this.masterDataService.getSubcategories();
  }

  @ApiOperation({ summary: 'Get filter options (cities, brands & attributes) for a product' })
  @Get('catalog-items/:slug/filters')
  async getItemFilters(@Param('slug') slug: string) {
    return this.masterDataService.getItemFilters(slug);
  }

  @ApiOperation({ summary: 'Get catalog item by ID' })
  @Get('catalog-items/:id')
  async getCatalogItemById(@Param('id') id: string) {
    return this.masterDataService.getCatalogItemById(id);
  }

  @ApiOperation({ summary: 'Create a new catalog item (Admin)' })
  @Post('catalog-items')
  async createCatalogItem(@Body() dto: CreateCatalogItemDto) {
    this.logger.log('Creating new catalog item');
    return this.masterDataService.createCatalogItem(dto);
  }

  @ApiOperation({ summary: 'Update a catalog item (Admin)' })
  @Put('catalog-items/:id')
  async updateCatalogItem(@Param('id') id: string, @Body() dto: UpdateCatalogItemDto) {
    return this.masterDataService.updateCatalogItem(id, dto);
  }

  @ApiOperation({ summary: 'Delete (soft) a catalog item (Admin)' })
  @Delete('catalog-items/:id')
  async deleteCatalogItem(@Param('id') id: string) {
    return this.masterDataService.deleteCatalogItem(id);
  }

  // ══════════════════════════════════════════
  //  CATALOG LISTINGS
  // ══════════════════════════════════════════

  @ApiOperation({ summary: 'Search listings with filters' })
  @ApiQuery({ name: 'itemSlug', required: false })
  @ApiQuery({ name: 'brand', required: false })
  @ApiQuery({ name: 'city', required: false })
  @Get('catalog-listings/search')
  async searchListings(
    @Query('itemSlug') itemSlug?: string,
    @Query('brand') brand?: string,
    @Query('city') city?: string,
  ) {
    return this.masterDataService.searchListings({ itemSlug, brand, city });
  }

  @ApiOperation({ summary: 'Get all catalog listings' })
  @Get('catalog-listings')
  async getAllCatalogListings() {
    return this.masterDataService.getAllCatalogListings();
  }

  @ApiOperation({ summary: 'Get listings for a specific catalog item' })
  @Get('catalog-listings/by-item/:itemId')
  async getListingsByItem(@Param('itemId') itemId: string) {
    return this.masterDataService.getListingsByItem(itemId);
  }

  @ApiOperation({ summary: 'Get listing by ID' })
  @Get('catalog-listings/:id')
  async getCatalogListingById(@Param('id') id: string) {
    return this.masterDataService.getCatalogListingById(id);
  }

  @ApiOperation({ summary: 'Create a new listing (Admin)' })
  @Post('catalog-listings')
  async createCatalogListing(@Body() dto: CreateCatalogListingDto) {
    this.logger.log('Creating new catalog listing');
    return this.masterDataService.createCatalogListing(dto);
  }

  @ApiOperation({ summary: 'Update a listing (Admin)' })
  @Put('catalog-listings/:id')
  async updateCatalogListing(@Param('id') id: string, @Body() dto: UpdateCatalogListingDto) {
    return this.masterDataService.updateCatalogListing(id, dto);
  }

  @ApiOperation({ summary: 'Delete (soft) a listing (Admin)' })
  @Delete('catalog-listings/:id')
  async deleteCatalogListing(@Param('id') id: string) {
    return this.masterDataService.deleteCatalogListing(id);
  }

  // ══════════════════════════════════════════
  //  PRICE HISTORY
  // ══════════════════════════════════════════

  @ApiOperation({ summary: 'Get price history for a listing' })
  @Get('catalog-listings/:id/price-history')
  async getPriceHistory(@Param('id') id: string, @Query('limit') limit?: number) {
    return this.masterDataService.getPriceHistory(id, limit || 30);
  }

  @ApiOperation({ summary: 'Add a price history entry (Admin)' })
  @Post('catalog-listings/:id/price-history')
  async addPriceHistory(
    @Param('id') id: string,
    @Body() body: { price: number; source?: string },
  ) {
    return this.masterDataService.addPriceHistoryEntry(id, body.price, body.source);
  }

  // ══════════════════════════════════════════
  //  BULK UPLOAD & SUMMARY
  // ══════════════════════════════════════════

  @ApiOperation({ summary: 'Get catalog data summary (counts)' })
  @Get('catalog-summary')
  async getCatalogSummary() {
    this.logger.log('Fetching catalog summary');
    return this.masterDataService.getCatalogSummary();
  }

  @ApiOperation({ summary: 'Bulk upload catalog items (Admin)' })
  @Post('bulk/catalog-items')
  async bulkUploadCatalogItems(@Body() body: { rows: any[] }) {
    this.logger.log('Bulk uploading catalog items');
    return this.masterDataService.bulkUploadCatalogItems(body.rows);
  }

  @ApiOperation({ summary: 'Bulk upload catalog listings (Admin)' })
  @Post('bulk/catalog-listings')
  async bulkUploadCatalogListings(@Body() body: { rows: any[] }) {
    return this.masterDataService.bulkUploadCatalogListings(body.rows);
  }

  // ══════════════════════════════════════════
  //  TESTING FLOWS
  // ══════════════════════════════════════════

  @ApiOperation({ summary: 'Reset Database for Testing (DANGER)' })
  @Post('reset-test-data')
  async resetTestData() {
    return this.masterDataService.resetTestData();
  }
}
