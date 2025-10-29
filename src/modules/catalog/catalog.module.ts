import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { OrganizationsModule } from '../organizations/organizations.module';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { Catalog, CatalogSchema } from './schemas/catalog.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Catalog.name, schema: CatalogSchema },
    ]),
    OrganizationsModule,
  ],
  controllers: [CatalogController],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
