import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Enquiry, EnquiryDocument, EnquiryStatus, EnquiryType } from './schemas/enquiry.schema';
import { OtpService } from '../otp/otp.service';
import { MasterDataService } from '../master-data/master-data.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UsersService } from '../users/services/users.service';
import { RfqService } from '../rfq/rfq.service';
import { RfqStatus } from 'src/common/enums';

@Injectable()
export class EnquiriesService {
  private readonly logger = new Logger(EnquiriesService.name);

  constructor(
    @InjectModel(Enquiry.name) private enquiryModel: Model<EnquiryDocument>,
    private otpService: OtpService,
    private masterDataService: MasterDataService,
    private organizationsService: OrganizationsService,
    private notificationsService: NotificationsService,
    private usersService: UsersService,
    private rfqService: RfqService,
  ) {}

  async createEnquiry(data: any): Promise<Enquiry> {
    const { otp, ...enquiryData } = data;

    // 1. Verify OTP first
    try {
      await this.otpService.verifyOtp(enquiryData.mobile, otp);
    } catch (err) {
      this.logger.error(`OTP Verification failed for ${enquiryData.mobile}: ${err.message}`);
      throw new BadRequestException('Incorrect or expired OTP. Please try again.');
    }

    // 2. Map and Save
    const newEnquiry = new this.enquiryModel({
      ...enquiryData,
      status: EnquiryStatus.NEW,
    });

    const saved = await newEnquiry.save();
    this.logger.log(`New ${saved.enquiryType} enquiry created: ${saved._id} for ${saved.fullName}`);
    
    // 3. Trigger Notifications
    this.notifyRelevantParties(saved).catch(err => 
      this.logger.error(`Failed to dispatch notifications for enquiry ${saved._id}: ${err.message}`)
    );
    
    return saved;
  }

  private async notifyRelevantParties(enquiry: EnquiryDocument) {
    if (enquiry.enquiryType === EnquiryType.SELL) {
      // SELL leads go to Admin first
      const admins = await this.usersService.findAdmins();
      for (const admin of admins) {
        await this.notificationsService.notify(
          admin._id.toString(),
          'New Seller Enquiry Captured',
          `${enquiry.fullName} from ${enquiry.city} has stock of ${enquiry.productName} (${enquiry.availableStock}MT).`,
          { category: 'MARKETPLACE_LEAD', data: { enquiryId: enquiry._id } }
        );
      }
    } else {
      // BUY leads: Notify relevant sellers (Category match)
      const catalogItem = await this.masterDataService.getCatalogItemBySlug(enquiry.productSlug);
      
      // Get all verified sellers
      const sellers = await this.usersService.findVerifiedSellers();
      
      for (const seller of sellers) {
        // Logic: Seller must deal in this category or subcategory
        const orgId = seller.organizationId?.toString();
        if (!orgId) continue;

        const org = await this.organizationsService.getOrganization(orgId);
        const expertiseTags = org.expertiseTags || [];
        
        // Simple match for now: check if org has listings in this category or explicit tags
        const listings = await this.masterDataService.getListingsByItem(catalogItem._id.toString());
        const isDealer = listings.some(l => l.supplier_name.toLowerCase() === org.legalName.toLowerCase());
        const hasTag = expertiseTags.some(t => t.isVerified && t.tag.toLowerCase() === catalogItem.subcategory.toLowerCase());

        if (isDealer || hasTag) {
          await this.notificationsService.notify(
            seller._id.toString(),
            'New Buy Opportunity!',
            `${enquiry.fullName} is looking for ${enquiry.productName} in ${enquiry.city}.`,
            { 
              template: 'marketplace-lead',
              data: {
                fullName: enquiry.fullName,
                mobile: enquiry.mobile,
                productName: enquiry.productName,
                quantity: enquiry.availableStock || enquiry.quantityMT, // Handles both types
                unit: catalogItem.unit,
                city: enquiry.city,
                timeline: enquiry.timeline,
                dashboardUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/seller/dashboard#radar`
              },
              category: 'MARKETPLACE_LEAD', 
              metadata: { enquiryId: enquiry._id } 
            }
          );
        }
      }
    }
  }

  async getCategorizedLeads(sellerId: string) {
    const user = await this.usersService.findById(sellerId);
    if (!user.organizationId) return { relevant: [], explore: [] };

    const org = await this.organizationsService.getOrganization(user.organizationId);
    
    // Find what this seller specializes in
    // 1. Listings
    const listings = await this.masterDataService.getAllCatalogListings();
    const sellerListings = listings.filter(l => l.supplier_name.toLowerCase() === org.legalName.toLowerCase());
    
    const listedSlugs = sellerListings.map(l => l.catalogItemSlug);
    const listedSubcategories = new Set<string>();
    const listedCategories = new Set<string>();

    for (const slug of listedSlugs) {
      try {
        const item = await this.masterDataService.getCatalogItemBySlug(slug);
        listedSubcategories.add(item.subcategory);
        listedCategories.add(item.category);
      } catch (e) {}
    }

    // 2. expertiseTags
    (org.expertiseTags || []).filter(t => t.isVerified).forEach(t => listedSubcategories.add(t.tag));

    const allLeads = await this.enquiryModel.find({ 
      enquiryType: EnquiryType.BUY,
      status: { $ne: EnquiryStatus.SPAM }
    }).sort({ createdAt: -1 }).exec();

    // Enhancing leads with item data for matching
    const enrichedLeads = await Promise.all(allLeads.map(async (lead) => {
      try {
        const item = await this.masterDataService.getCatalogItemBySlug(lead.productSlug);
        return { lead, item };
      } catch (e) {
        return { lead, item: null };
      }
    }));

    const relevant: any[] = [];
    const explore: any[] = [];

    enrichedLeads.forEach(({ lead, item }) => {
      if (!item) {
        explore.push(lead);
        return;
      }

      const isExactMatch = listedSlugs.includes(item.slug);
      const isSubMatch = listedSubcategories.has(item.subcategory);

      if (isExactMatch || isSubMatch) {
        relevant.push(lead);
      } else if (listedCategories.has(item.category)) {
        explore.push(lead);
      }
    });

    return { relevant, explore };
  }

  async trackClick(id: string, type: 'call' | 'whatsapp') {
    const field = type === 'call' ? 'actionMetrics.callClicks' : 'actionMetrics.whatsappClicks';
    return this.enquiryModel.findByIdAndUpdate(id, { $inc: { [field]: 1 } }, { new: true }).exec();
  }

  async findAll() {
    return this.enquiryModel.find().sort({ createdAt: -1 }).exec();
  }

  async findOne(id: string) {
    return this.enquiryModel.findById(id).exec();
  }

  async updateStatus(id: string, status: EnquiryStatus) {
    return this.enquiryModel.findByIdAndUpdate(id, { status }, { new: true }).exec();
  }
  
  async convertToRfq(id: string, adminUserId: string) {
    const enquiry = await this.findOne(id);
    if (!enquiry) throw new NotFoundException('Enquiry not found');
    
    // 1. Logic: Check if user exists by mobile
    let user = await this.usersService.findByMobile(enquiry.mobile);
    let organizationId: string;
    
    if (!user) {
        this.logger.log(`Auto-onboarding guest buyer: ${enquiry.fullName}`);
        // This is a simplified guest-onboarding for RFQ creation
        // ideally uses AdminOnboardingService, but here we keep it direct
        // for "Auto-Generate RFQ" POC
        const org = await this.organizationsService.create({
            legalName: `${enquiry.fullName} (Guest)`,
            businessType: 'INDIVIDUAL',
            city: enquiry.city,
        } as any);
        
        organizationId = (org as any)._id.toString();
        // Since we don't have email, we might hit issues if email is mandatory
        // For now, we skip user creation if no email, and just create RFQ under Admin
    } else {
        organizationId = user.organizationId?.toString();
    }
    
    if (!organizationId) {
        // Fallback: Create under a placeholder System/Admin Org if necessary
        // but here we throw error as we need a buyer
        throw new BadRequestException('Lead must be onboarded (Fast-Track) before RFQ generation.');
    }

    const catalogItem = await this.masterDataService.getCatalogItemBySlug(enquiry.productSlug);

    // 2. Create RFQ
    return this.rfqService.create(adminUserId, organizationId, {
      buyerOrgName: enquiry.fullName,
      category: catalogItem.category,
      subCategory: catalogItem.subcategory,
      grade: (enquiry as any).attributes?.grade || 'Standard',
      quantityMT: enquiry.quantityMT || enquiry.availableStock || 0,
      targetPin: '000000', // Unknown from guest
      deliveryBy: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days default
      incoterm: 'FOR',
      notes: `Auto-generated from enquiry ${id}. ${enquiry.message || ''}`,
      status: RfqStatus.OPEN,
    } as any);
  }
}
