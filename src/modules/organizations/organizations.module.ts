import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FileStorageService } from "../../core/file/services/file-storage.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { Organization, OrganizationSchema } from "./schemas/organization.schema";
@Module({
  imports: [MongooseModule.forFeature([{ name: Organization.name, schema: OrganizationSchema }])],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, FileStorageService],
  exports: [OrganizationsService, MongooseModule],
})
export class OrganizationsModule {}
