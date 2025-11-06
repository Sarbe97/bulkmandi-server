import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { KycModule } from "../kyc/kyc.module";
import { FileStorageService } from "../storage/services/file-storage.service";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import {
  Organization,
  OrganizationSchema,
} from "./schemas/organization.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
    ]),
    KycModule
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, FileStorageService],
  exports: [OrganizationsService, MongooseModule],
})
export class OrganizationsModule {}
