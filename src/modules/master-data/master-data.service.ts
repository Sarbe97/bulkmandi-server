import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';
import { Model, Connection } from 'mongoose';
import { MasterData, MasterDataDocument } from './schema/master-data.schema';
import { CatalogItem, CatalogItemDocument } from './schema/catalog-item.schema';
import { CatalogListing, CatalogListingDocument } from './schema/catalog-listing.schema';
import {
  CreateCatalogItemDto, UpdateCatalogItemDto,
  CreateCatalogListingDto, UpdateCatalogListingDto,
} from './dto/catalog-data.dto';
import * as fs from 'fs';
import * as path from 'path';
import { UsersService } from '../users/services/users.service';

@Injectable()
export class MasterDataService implements OnModuleInit {
  private readonly logger = new Logger(MasterDataService.name);

  constructor(
    @InjectModel(MasterData.name) private masterDataModel: Model<MasterDataDocument>,
    @InjectModel(CatalogItem.name) private catalogItemModel: Model<CatalogItemDocument>,
    @InjectModel(CatalogListing.name) private catalogListingModel: Model<CatalogListingDocument>,
    @InjectConnection() private connection: Connection,
    private readonly usersService: UsersService,
  ) { }

  // ══════════════════════════════════════════
  //  MODULE INIT – SEEDING
  // ══════════════════════════════════════════

  async onModuleInit() {
    await this.seedLegacyMasterData();
    await this.seedCatalogData();
  }

  /** Original legacy seed – fleet types & product categories */
  private async seedLegacyMasterData() {
    const exists = await this.masterDataModel.findOne();
    if (!exists) {
      const defaultFleets = [
        { type: '20t_open', label: '20 t Open' },
        { type: '25t_trailer', label: '25 t Trailer' },
        { type: 'covered_16t', label: 'Covered 16 t' },
        { type: '32t_multi_axle', label: '32 t Multi Axle' },
        { type: 'container_32ft', label: 'Container 32 ft' },
      ];
      const defaultCategories = [
        { name: 'HR Coils', grades: ['IS 2062 E250', 'IS 2062 E350', 'IS 2062 E500'] },
        { name: 'TMT Bars', grades: ['Fe500', 'Fe500D', 'Fe550'] },
        { name: 'Plates', grades: ['Mild Steel', 'High Strength', 'Stainless Steel'] },
        { name: 'Structural', grades: ['IPN', 'IPE', 'ISMB', 'ISJB'] },
      ];
      await this.masterDataModel.create({ fleetTypes: defaultFleets, productCategories: defaultCategories });
    }
  }

  /** Seed catalog items and sample listings */
  private async seedCatalogData() {
    const count = await this.catalogItemModel.countDocuments();
    if (count > 0) {
      this.logger.log('Catalog data already seeded, skipping.');
      return;
    }

    this.logger.log('Seeding catalog data from CSV...');

    try {
      const itemsPath = path.join(process.cwd(), 'seed-data', 'catalog_items_upload.csv');
      const listingsPath = path.join(process.cwd(), 'seed-data', 'catalog_listings_upload.csv');

      if (fs.existsSync(itemsPath)) {
        const itemRows = this.parseCsvToJson(fs.readFileSync(itemsPath, 'utf8'));
        const resultItems = await this.bulkUploadCatalogItems(itemRows);
        this.logger.log(`Seeded catalog items: ${resultItems.created} created, ${resultItems.updated} updated. Errors: ${resultItems.errors.length}`);
        if (resultItems.errors.length > 0) {
          this.logger.error(`Catalog items seed errors: ${JSON.stringify(resultItems.errors)}`);
        }
      }

      if (fs.existsSync(listingsPath)) {
        const listingRows = this.parseCsvToJson(fs.readFileSync(listingsPath, 'utf8'));
        const resultListings = await this.bulkUploadCatalogListings(listingRows);
        this.logger.log(`Seeded catalog listings: ${resultListings.created} created.`);
      }
    } catch (e) {
      this.logger.error('Failed to seed catalog data from CSV', e);
    }
  }

  private parseCsvToJson(csvText: string): any[] {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
      // Regex perfectly splits by comma, ignoring commas inside double-quotes
      const data = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      const row: any = {};
      headers.forEach((h, i) => {
        let val = data[i] || '';
        // Remove outer quotes, then replace escaped "" with "
        val = val.trim().replace(/^"|"$/g, '').replace(/""/g, '"').trim();
        row[h] = val;
      });
      return row;
    });
  }

  // ══════════════════════════════════════════
  //  LEGACY – Fleet Types & Product Categories
  // ══════════════════════════════════════════

  async getFleetTypes() {
    const data = await this.masterDataModel.findOne().select('fleetTypes');
    return data ? data.fleetTypes : [];
  }

  async addFleetType(type: string, label: string) {
    const data = await this.masterDataModel.findOne();
    if (data) {
      const exists = data.fleetTypes.some(ft => ft.type === type);
      if (!exists) { data.fleetTypes.push({ type, label }); await data.save(); }
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

  // ══════════════════════════════════════════
  //  CATALOG ITEMS – CRUD
  // ══════════════════════════════════════════

  async createCatalogItem(dto: CreateCatalogItemDto) {
    return this.catalogItemModel.create(dto);
  }

  async getAllCatalogItems(subcategory?: string) {
    const filter: any = { isActive: true };
    if (subcategory) filter.subcategory = subcategory;
    return this.catalogItemModel.find(filter).sort({ subcategory: 1, displayOrder: 1, product_type: 1 });
  }

  async getCatalogItemById(id: string) {
    const item = await this.catalogItemModel.findById(id);
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }

  async getCatalogItemBySlug(slug: string) {
    const item = await this.catalogItemModel.findOne({ slug });
    if (!item) throw new NotFoundException(`Catalog item with slug "${slug}" not found`);
    return item;
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemDto) {
    const item = await this.catalogItemModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!item) throw new NotFoundException('Catalog item not found');
    return item;
  }

  async deleteCatalogItem(id: string) {
    return this.catalogItemModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  /** Get distinct subcategories */
  async getSubcategories(): Promise<string[]> {
    return this.catalogItemModel.distinct('subcategory', { isActive: true });
  }

  /** Get filter options for a given product slug (cities + brands aggregated from listings) */
  async getItemFilters(slug: string) {
    const item = await this.catalogItemModel.findOne({ slug, isActive: true });
    if (!item) throw new NotFoundException('Item not found');

    const cities = await this.catalogListingModel.distinct('city', { catalogItemId: item._id, isActive: true });
    const brands = await this.catalogListingModel.distinct('brand', { catalogItemId: item._id, isActive: true });

    return { cities, brands, attributes: item.attributes };
  }

  // ══════════════════════════════════════════
  //  CATALOG LISTINGS – CRUD
  // ══════════════════════════════════════════

  async createCatalogListing(dto: CreateCatalogListingDto) {
    // Resolve slug to ID if needed
    let itemId = dto.catalogItemId;
    let item: any = null;
    if (!itemId.match(/^[0-9a-fA-F]{24}$/)) {
      item = await this.catalogItemModel.findOne({ slug: itemId });
      if (!item) throw new NotFoundException(`Catalog item "${itemId}" not found`);
      itemId = item._id.toString();
    } else {
      item = await this.catalogItemModel.findById(itemId);
      if (!item) throw new NotFoundException(`Catalog item ID not found`);
    }

    const catalogItemSlug = item.slug;
    const city = dto.city.trim().toLowerCase();
    const supplier_name = dto.supplier_name.trim().toLowerCase();

    const normalizedAttributes: Record<string, string> = {};
    for (const key of Object.keys(item.attributes || {})) {
      const providedValue = dto.attributes[key];
      if (providedValue) {
        const allowedValues = Array.isArray(item.attributes[key]) ? item.attributes[key] : [];
        if (allowedValues.length > 0 && !allowedValues.includes(providedValue)) {
          throw new BadRequestException(`Invalid attribute value for '${key}': '${providedValue}'. Allowed: ${allowedValues.join(', ')}`);
        }
        normalizedAttributes[key] = providedValue;
      }
    }

    const uniqueKeyProps = Object.keys(normalizedAttributes).sort().map(k => `${k}=${normalizedAttributes[k]}`).join('|');
    const uniqueKey = `${catalogItemSlug}|${supplier_name}|${city}${uniqueKeyProps ? '|' + uniqueKeyProps : ''}`;

    return this.catalogListingModel.create({
      ...dto,
      uniqueKey,
      catalogItemId: itemId,
      catalogItemSlug,
      city,
      supplier_name,
      attributes: normalizedAttributes
    });
  }

  async getAllCatalogListings() {
    return this.catalogListingModel.find({ isActive: true }).sort({ city: 1, brand: 1 });
  }

  async getListingsByItem(catalogItemId: string) {
    return this.catalogListingModel.find({ catalogItemId, isActive: true }).sort({ city: 1, brand: 1 });
  }

  async getCatalogListingById(id: string) {
    const listing = await this.catalogListingModel.findById(id);
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async updateCatalogListing(id: string, dto: UpdateCatalogListingDto) {
    const listing = await this.catalogListingModel.findByIdAndUpdate(id, { $set: dto }, { new: true });
    if (!listing) throw new NotFoundException('Listing not found');
    return listing;
  }

  async deleteCatalogListing(id: string) {
    return this.catalogListingModel.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  // ══════════════════════════════════════════
  //  SEARCH & FILTERS
  // ══════════════════════════════════════════

  async searchListings(filters: { itemSlug?: string; brand?: string; city?: string; search?: string }) {
    const query: any = { isActive: true };

    if (filters.itemSlug) {
      const item = await this.catalogItemModel.findOne({ slug: filters.itemSlug });
      if (item) query.catalogItemId = item._id;
    }
    if (filters.brand) query.brand = filters.brand;
    if (filters.city) query.city = filters.city;

    const listings = await this.catalogListingModel
      .find(query)
      .populate('catalogItemId', 'product_type slug subcategory unit image attributes specifications showOnHome')
      .sort({ basePrice: 1 });

    return listings;
  }

  // ══════════════════════════════════════════
  //  PRICE HISTORY
  // ══════════════════════════════════════════

  async addPriceHistoryEntry(listingId: string, price: number, source?: string) {
    const listing = await this.catalogListingModel.findById(listingId);
    if (!listing) throw new NotFoundException('Listing not found');

    listing.priceHistory.push({ price, date: new Date(), source: source || '' });
    listing.basePrice = price; // update current price too
    await listing.save();
    return listing;
  }

  async getPriceHistory(listingId: string, limit = 30) {
    const listing = await this.catalogListingModel.findById(listingId).select('priceHistory');
    if (!listing) throw new NotFoundException('Listing not found');
    return listing.priceHistory.slice(-limit);
  }

  // ══════════════════════════════════════════
  //  CATALOG SUMMARY
  // ══════════════════════════════════════════

  async getCatalogSummary() {
    const [catalogItems, catalogListings] = await Promise.all([
      this.catalogItemModel.countDocuments({ isActive: true }),
      this.catalogListingModel.countDocuments({ isActive: true }),
    ]);
    const subcategories = await this.catalogItemModel.distinct('subcategory', { isActive: true });
    const allBrands = await this.catalogListingModel.distinct('brand', { isActive: true });
    const allCities = await this.catalogListingModel.distinct('city', { isActive: true });
    return {
      catalogItems,
      catalogListings,
      subcategories: subcategories.length,
      brands: allBrands.length,
      cities: allCities.length,
    };
  }

  // ══════════════════════════════════════════
  //  BULK UPLOAD
  // ══════════════════════════════════════════

  async bulkUploadCatalogItems(rows: any[]) {
    let created = 0, updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        if (!row.category || !row.product_type || !row.slug || !row.subcategory) {
          errors.push({ row: i + 1, error: 'Missing required fields: category, product_type, slug, subcategory' });
          continue;
        }

        const isActive = row.is_active !== undefined ? (row.is_active === 'true' || row.is_active === '1' || row.is_active === true) : true;

        let search_keywords: string[] = [];
        if (typeof row.search_keywords === 'string' && row.search_keywords.trim()) {
          search_keywords = row.search_keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
        }
        if (!search_keywords.length) {
          search_keywords = [
            row.category.toLowerCase(),
            row.subcategory.toLowerCase(),
            row.product_type.toLowerCase()
          ];
        }

        // Parse attributes JSON string from CSV
        let attributes: Record<string, any> = {};
        if (typeof row.attributes === 'string' && row.attributes.trim()) {
          let attrStr = row.attributes.trim();
          // Apply defensive CSV unescaping in case PapaParse sends the raw string
          if (attrStr.startsWith('"') && attrStr.endsWith('"')) {
            attrStr = attrStr.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          } else if (attrStr.includes('""')) {
            attrStr = attrStr.replace(/""/g, '"').trim();
          }

          try {
            attributes = JSON.parse(attrStr);
          } catch (e: any) {
            this.logger.warn(`Row ${i + 1}: Invalid attributes JSON. Raw string: [${row.attributes}]. Parsed as: [${attrStr}]. Error: ${e.message}`);
          }
        }

        // Parse specifications JSON string from CSV
        let specifications: any = {};
        if (typeof row.specifications === 'string' && row.specifications.trim()) {
          let specStr = row.specifications.trim();
          if (specStr.startsWith('"') && specStr.endsWith('"')) {
            specStr = specStr.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          }
          try {
            specifications = JSON.parse(specStr);
          } catch (e: any) {
            this.logger.warn(`Row ${i + 1}: Invalid specifications JSON. Error: ${e.message}`);
          }
        }

        const showOnHome = row.showOnHome === 'true' || row.showOnHome === '1' || row.showOnHome === true;

        // Ensure attributes is an object
        if (!attributes) attributes = {};

        const existing = await this.catalogItemModel.findOne({ slug: row.slug });
        if (existing) {
          await this.catalogItemModel.updateOne({ slug: row.slug }, {
            $set: {
              category: row.category, product_type: row.product_type, subcategory: row.subcategory,
              displayOrder: row.displayOrder || existing.displayOrder,
              description: row.description || existing.description,
              unit: row.unit || existing.unit,
              hsnCode: row.hsnCode || existing.hsnCode,
              image: row.image || existing.image,
              attributes: row.attributes ? attributes : existing.attributes,
              specifications: row.specifications ? specifications : existing.specifications,
              showOnHome: row.showOnHome !== undefined ? showOnHome : existing.showOnHome,
              search_keywords: row.search_keywords ? search_keywords : existing.search_keywords,
              isActive,
            },
          });
          updated++;
        } else {
          await this.catalogItemModel.create({
            category: row.category, product_type: row.product_type, slug: row.slug, subcategory: row.subcategory,
            displayOrder: row.displayOrder || 0,
            description: row.description || '',
            unit: row.unit || 'MT',
            hsnCode: row.hsnCode || '',
            image: row.image || '',
            attributes,
            specifications,
            showOnHome,
            search_keywords,
            isActive,
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return { created, updated, errors, total: rows.length };
  }

  async bulkUploadCatalogListings(rows: any[]) {
    let created = 0, updated = 0;
    const errors: { row: number; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      try {
        const row = rows[i];
        const city = row.city ? row.city.toLowerCase().trim() : '';
        if (!row.brand || !city || !row.basePrice || !row.attributes) {
          errors.push({ row: i + 1, error: 'Missing required fields: brand, city, basePrice, attributes' });
          continue;
        }

        let attributes: Record<string, string> = {};
        if (typeof row.attributes === 'string' && row.attributes.trim()) {
          let attrStr = row.attributes.trim();
          if (attrStr.startsWith('"') && attrStr.endsWith('"')) {
            attrStr = attrStr.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
          } else if (attrStr.includes('""')) {
            attrStr = attrStr.replace(/""/g, '"').trim();
          }
          try {
            attributes = JSON.parse(attrStr);
          } catch (e: any) {
            this.logger.warn(`Listing Row ${i + 1}: Invalid attributes JSON. Error: ${e.message}`);
          }
        }

        const supplier_name = row.supplier_name ? row.supplier_name.trim().toLowerCase() : '';
        const lead_time = row.lead_time ? Number(row.lead_time) : 0;
        const isActive = row.is_active !== undefined ? (row.is_active === 'true' || row.is_active === '1' || row.is_active === true) : true;

        // Resolve catalogItemId from slug
        let itemId = row.catalogItemId;
        let item: any = null;
        if (row.catalogItemSlug) {
          item = await this.catalogItemModel.findOne({ slug: row.catalogItemSlug });
          if (!item) {
            errors.push({ row: i + 1, error: `Catalog item "${row.catalogItemSlug}" not found` });
            continue;
          }
          itemId = item._id;
        } else if (itemId) {
          item = await this.catalogItemModel.findById(itemId);
        }

        if (!itemId || !item) {
          errors.push({ row: i + 1, error: 'No catalogItemId or catalogItemSlug provided / valid' });
          continue;
        }

        const catalogItemSlug = item.slug;

        // Validate attributes against catalog and DO NOT store nulls if inapplicable
        let isValidAttributes = true;
        const normalizedAttributes: Record<string, string> = {};

        for (const key of Object.keys(item.attributes || {})) {
          const providedValue = attributes[key];
          if (providedValue) {
            const allowedValues = Array.isArray(item.attributes[key]) ? item.attributes[key] : [];
            if (allowedValues.length > 0 && !allowedValues.includes(providedValue)) {
              errors.push({ row: i + 1, error: `Invalid attribute value for '${key}': '${providedValue}'. Allowed: ${allowedValues.join(', ')}` });
              isValidAttributes = false;
              break;
            }
            normalizedAttributes[key] = providedValue;
          }
        }
        if (!isValidAttributes) continue;

        const uniqueKeyProps = Object.keys(normalizedAttributes).sort().map(k => `${k}=${normalizedAttributes[k]}`).join('|');
        const uniqueKey = `${catalogItemSlug}|${supplier_name}|${city}${uniqueKeyProps ? '|' + uniqueKeyProps : ''}`;

        const existing = await this.catalogListingModel.findOne({ uniqueKey });

        if (existing) {
          existing.basePrice = Number(row.basePrice);
          existing.stockQty = row.stockQty != null ? Number(row.stockQty) : existing.stockQty;
          existing.moq = row.moq != null ? Number(row.moq) : existing.moq;
          existing.lead_time = lead_time || existing.lead_time;
          existing.isActive = isActive;
          existing.attributes = normalizedAttributes;
          existing.priceHistory.push({ price: Number(row.basePrice), date: new Date(), source: 'bulk_upload' });
          await existing.save();
          updated++;
        } else {
          await this.catalogListingModel.create({
            uniqueKey,
            catalogItemId: itemId,
            catalogItemSlug,
            brand: row.brand,
            city,
            supplier_name,
            attributes: normalizedAttributes,
            lead_time,
            isActive,
            basePrice: Number(row.basePrice),
            stockQty: row.stockQty ? Number(row.stockQty) : 0,
            moq: row.moq ? Number(row.moq) : 1,
            priceHistory: [{ price: Number(row.basePrice), date: new Date(), source: 'bulk_upload' }],
          });
          created++;
        }
      } catch (err: any) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return { created, updated, errors, total: rows.length };
  }

  // ══════════════════════════════════════════
  //  TESTING UTILITIES
  // ══════════════════════════════════════════

  async resetTestData() {
    this.logger.warn('⚠️  DANGER: resetTestData() called. Starting full wipe...');

    // ── Pre-Wipe Backup: Users ──────────────────────────────────────────────
    try {
      this.logger.log('📥 Generating users backup before wipe...');
      const usersCsv = await this.usersService.downloadUsersCsv();
      const backupDir = path.join(process.cwd(), 'seed-data');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      
      const backupPath = path.join(backupDir, 'users_export.csv');
      fs.writeFileSync(backupPath, usersCsv);
      this.logger.log(`✅ Users backup saved to: ${backupPath}`);
    } catch (e) {
      this.logger.error('❌ Failed to take users backup. Aborting wipe to prevent data loss.', e);
      throw new Error(`Wipe aborted: User backup failed. ${e.message}`);
    }

    // ── Collections to completely wipe (including users & orgs now) ──────────
    const WIPE_COLLECTIONS = [
      'users',
      'organizations',
      'rfqs',
      'quotes',
      'orders',
      'shipments',
      'payments',
      'settlementbatches',
      'payouts',
      'disputes',
      'notifications',
      'otps',
      'buyerpreferences',
      'sellerpreferences',
      'logisticpreferences',
      'auditlogs',
    ];

    // ── Collections to NEVER touch (Static Seeding Data) ─────────────────────
    const PRESERVE_COLLECTIONS = [
      'masterdatas',      // Fleet types, product categories (seed data)
      'catalogitems',     // Product catalog (seed data)
      'cataloglistings',  // Price listings (seed data)
      'system.views',
    ];

    const report: Record<string, { action: string; count: number }> = {};
    const allCollections = await this.connection.db.collections();

    for (const collection of allCollections) {
      const name = collection.collectionName.toLowerCase();

      if (PRESERVE_COLLECTIONS.includes(name)) {
        const count = await collection.countDocuments();
        report[name] = { action: 'preserved', count };
        this.logger.log(`✅ Preserved: ${name} (${count} docs)`);
        continue;
      }

      if (WIPE_COLLECTIONS.includes(name)) {
        const result = await collection.deleteMany({});
        report[name] = { action: 'wiped', count: result.deletedCount };
        this.logger.log(`🗑️  Wiped: ${name} (${result.deletedCount} docs)`);
        continue;
      }

      // Unknown collection — log but don't touch
      const count = await collection.countDocuments();
      report[name] = { action: 'skipped (unknown)', count };
      this.logger.warn(`⏭️  Skipped unknown collection: ${name} (${count} docs)`);
    }

    this.logger.log('✅ Database reset complete.');
    return {
      success: true,
      message: 'Database wiped. All users, organizations and transactional data deleted. Users backup saved to seed-data/users_export.csv.',
      report,
    };
  }
}

