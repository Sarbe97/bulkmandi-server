import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { FileStorageService } from "../../core/file/services/file-storage.service";
import { IdGeneratorService } from "../../common/services/id-generator.service";
import { KycCase, KycCaseSchema } from "../kyc/schemas/kyc.schema";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationsService } from "./organizations.service";
import { Organization, OrganizationSchema } from "./schemas/organization.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Organization.name, schema: OrganizationSchema },
      { name: KycCase.name, schema: KycCaseSchema }, // ✅ Added for IdGeneratorService
    ]),
  ],
  controllers: [OrganizationsController],
  providers: [OrganizationsService, FileStorageService, IdGeneratorService], // ✅ Added IdGeneratorService
  exports: [OrganizationsService, MongooseModule, IdGeneratorService], // ✅ Export for other modules
})
export class OrganizationsModule { }
