import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { Organization, OrganizationDocument } from "./schemas/organization.schema";

/**
 * OrganizationsService
 *
 * Handles generic organization concerns only.
 * Seller-specific onboarding logic has been moved to SellerService.
 * Buyer-specific onboarding logic is in BuyerService.
 */
@Injectable()
export class OrganizationsService {
  constructor(
    @InjectModel(Organization.name)
    private orgModel: Model<OrganizationDocument>,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Create a new organization
   */
  async createOrganization(data: any): Promise<OrganizationDocument> {
    try {
      this.logger.log("Creating organization", "OrganizationsService.createOrganization");

      const org = new this.orgModel({
        ...data,
        kycStatus: "DRAFT",
        isOnboardingLocked: false,
        completedSteps: [],
      });

      const savedOrg = await org.save();

      this.logger.log(`Organization created with id ${savedOrg._id}`, "OrganizationsService.createOrganization");
      return savedOrg;
    } catch (error) {
      this.logger.log(`Error creating organization: ${error.message}`, "OrganizationsService.createOrganization");
      throw error;
    }
  }

  /**
   * Get organization by ID
   */
  async getOrganization(orgId: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization with id ${orgId}`, "OrganizationsService.getOrganization");

      const org = await this.orgModel.findById(orgId);
      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.getOrganization");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization ${orgId}: ${error.message}`, "OrganizationsService.getOrganization");
      throw error;
    }
  }

  /**
   * Get organization by OrganizationId (orgId field)
   */
  async getOrganizationByOrgId(orgId: string): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Fetching organization by orgId: ${orgId}`, "OrganizationsService.getOrganizationByOrgId");

      const org = await this.orgModel.findOne({ orgId });
      if (!org) {
        this.logger.log(`Organization not found with orgId: ${orgId}`, "OrganizationsService.getOrganizationByOrgId");
        throw new NotFoundException("Organization not found");
      }
      return org;
    } catch (error) {
      this.logger.log(`Error fetching organization by orgId ${orgId}: ${error.message}`, "OrganizationsService.getOrganizationByOrgId");
      throw error;
    }
  }

  /**
   * Update organization (generic fields only, not onboarding)
   */
  async updateOrganization(orgId: string, updateData: any): Promise<OrganizationDocument> {
    try {
      this.logger.log(`Updating organization ${orgId}`, "OrganizationsService.updateOrganization");

      const org = await this.orgModel.findByIdAndUpdate(orgId, updateData, {
        new: true,
      });

      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.updateOrganization");
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Organization updated: ${orgId}`, "OrganizationsService.updateOrganization");
      return org;
    } catch (error) {
      this.logger.log(`Error updating organization ${orgId}: ${error.message}`, "OrganizationsService.updateOrganization");
      throw error;
    }
  }

  /**
   * Delete organization
   */
  async deleteOrganization(orgId: string): Promise<{ message: string }> {
    try {
      this.logger.log(`Deleting organization with id ${orgId}`, "OrganizationsService.deleteOrganization");

      const org = await this.orgModel.findByIdAndDelete(orgId);

      if (!org) {
        this.logger.log(`Organization not found: ${orgId}`, "OrganizationsService.deleteOrganization");
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Organization deleted with id ${orgId}`, "OrganizationsService.deleteOrganization");
      return { message: "Organization deleted successfully" };
    } catch (error) {
      this.logger.log(`Error deleting organization ${orgId}: ${error.message}`, "OrganizationsService.deleteOrganization");
      throw error;
    }
  }

  /**
   * Find organization by multiple criteria
   */
  async findOne(filter: any): Promise<OrganizationDocument | null> {
    try {
      this.logger.log(`Searching organization with filter: ${JSON.stringify(filter)}`, "OrganizationsService.findOne");

      const org = await this.orgModel.findOne(filter);
      return org || null;
    } catch (error) {
      this.logger.log(`Error searching organization: ${error.message}`, "OrganizationsService.findOne");
      throw error;
    }
  }

  /**
   * Find all organizations
   */
  async findAll(filter: any = {}): Promise<OrganizationDocument[]> {
    try {
      this.logger.log(`Fetching all organizations with filter: ${JSON.stringify(filter)}`, "OrganizationsService.findAll");

      const orgs = await this.orgModel.find(filter);
      return orgs;
    } catch (error) {
      this.logger.log(`Error fetching organizations: ${error.message}`, "OrganizationsService.findAll");
      throw error;
    }
  }

  /**
   * Count organizations
   */
  async countOrganizations(filter: any = {}): Promise<number> {
    try {
      const count = await this.orgModel.countDocuments(filter);
      return count;
    } catch (error) {
      this.logger.log(`Error counting organizations: ${error.message}`, "OrganizationsService.countOrganizations");
      throw error;
    }
  }
}
