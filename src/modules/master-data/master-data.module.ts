import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { MasterData, MasterDataSchema } from './schema/master-data.schema';
import { CatalogItem, CatalogItemSchema } from './schema/catalog-item.schema';
import { CatalogListing, CatalogListingSchema } from './schema/catalog-listing.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: MasterData.name, schema: MasterDataSchema },
      { name: CatalogItem.name, schema: CatalogItemSchema },
      { name: CatalogListing.name, schema: CatalogListingSchema },
    ]),
  ],
  controllers: [MasterDataController],
  providers: [MasterDataService],
  exports: [MasterDataService],
})
export class MasterDataModule {}
