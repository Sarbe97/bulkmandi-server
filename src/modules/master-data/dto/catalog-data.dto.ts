import { IsBoolean, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── CatalogItem DTOs ──

export class CreateCatalogItemDto {
  @ApiProperty({ example: 'Primary TMT' })
  @IsString()
  product_type: string;

  @ApiProperty({ example: 'primary_tmt' })
  @IsString()
  slug: string;

  @ApiProperty({ example: 'Mild Steel' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'Long Products' })
  @IsString()
  subcategory: string;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'MT' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: '72142000' })
  @IsOptional()
  @IsString()
  hsnCode?: string;

  @ApiPropertyOptional({ example: { grade: ['Fe500', 'Fe500D'], size: ['8mm', '12mm'], finish: [] } })
  @IsOptional()
  @IsObject()
  attributes?: Record<string, any>;

  @ApiPropertyOptional({ example: ['tmt', 'steel'] })
  @IsOptional()
  @IsString({ each: true })
  search_keywords?: string[];

  @ApiPropertyOptional({ example: { is_lme_linked: true, standard: 'IS 1786:2008', gst_rate: 18, min_order_quantity: 25 } })
  @IsOptional()
  @IsObject()
  specifications?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  showOnHome?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCatalogItemDto {
  @IsOptional() @IsString() product_type?: string;
  @IsOptional() @IsString() slug?: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() subcategory?: string;
  @IsOptional() @IsNumber() displayOrder?: number;
  @IsOptional() @IsString() image?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() unit?: string;
  @IsOptional() @IsString() hsnCode?: string;
  @IsOptional() @IsObject() attributes?: Record<string, any>;
  @IsOptional() @IsString({ each: true }) search_keywords?: string[];
  @IsOptional() @IsObject() specifications?: Record<string, any>;
  @IsOptional() @IsBoolean() showOnHome?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

// ── CatalogListing DTOs ──

export class CreateCatalogListingDto {
  @ApiProperty({ description: 'CatalogItem ID or slug' })
  @IsString()
  catalogItemId: string;

  @ApiProperty({ example: 'Tata Tiscon' })
  @IsString()
  brand: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  city: string;

  @ApiProperty({ example: 52000 })
  @IsNumber()
  basePrice: number;

  @ApiPropertyOptional({ example: 'INR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @IsNumber()
  stockQty?: number;

  @ApiPropertyOptional({ example: 5 })
  @IsOptional()
  @IsNumber()
  moq?: number;

  @ApiProperty({ example: 'ABC Steel' })
  @IsString()
  supplier_name: string;

  @ApiProperty({ example: { grade: 'Fe500', size: '12mm' } })
  @IsObject()
  attributes: Record<string, string>;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @IsNumber()
  lead_time?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCatalogListingDto {
  @IsOptional() @IsString() brand?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() basePrice?: number;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsNumber() stockQty?: number;
  @IsOptional() @IsNumber() moq?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
