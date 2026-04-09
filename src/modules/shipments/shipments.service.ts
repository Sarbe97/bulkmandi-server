import { Injectable, NotFoundException, Inject, forwardRef, BadRequestException } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { FileStorageService } from "src/core/file/services/file-storage.service";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { Shipment, ShipmentDocument } from "./schemas/shipment.schema";
import { ShipmentRfq, ShipmentRfqDocument } from "./schemas/shipment-rfq.schema";
import { ShipmentBid, ShipmentBidDocument } from "./schemas/shipment-bid.schema";
import { 
  AuditAction, 
  AuditModule, 
  AuditEntityType, 
  LogisticsPreference 
} from "src/common/constants/app.constants";
import { 
  ShipmentRfqStatus, 
  OrderStatus 
} from "src/common/enums";

import { SellerPreference, SellerPreferenceDocument } from "../preferences/schemas/seller-preference.schema";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { OrganizationsService } from "../organizations/organizations.service";

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(ShipmentRfq.name) private shipmentRfqModel: Model<ShipmentRfqDocument>,
    @InjectModel(ShipmentBid.name) private shipmentBidModel: Model<ShipmentBidDocument>,
    @InjectModel(SellerPreference.name) private sellerPrefModel: Model<SellerPreferenceDocument>,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
    private readonly organizationsService: OrganizationsService,
    private readonly fileStorageService: FileStorageService,
    private readonly auditService: AuditService,
    private readonly logger: CustomLoggerService,
  ) {}

  async create(sellerId: string, dto: CreateShipmentDto) {
    this.logger.log(`Creating new shipment for order: ${dto.orderId} by seller: ${sellerId}`);
    const order = await this.ordersService.findByIdOrFail(dto.orderId);
    if (order.sellerId.toString() !== sellerId) {
      throw new NotFoundException("Order not found or access denied");
    }

    // Determine logistics mode based on Priority:
    // 1. Explicit mode from DTO
    // 2. Seller's preference (defaulting to PLATFORM_3PL)
    const sellerPref = await this.sellerPrefModel.findOne({ organizationId: sellerId });
    
    let logisticsMode: 'PLATFORM_3PL' | 'SELF_PICKUP' | 'SELLER_MANAGED' | undefined = dto.logisticsMode;
    if (!logisticsMode) {
      if (order.logisticsPreference) {
        logisticsMode = order.logisticsPreference as 'PLATFORM_3PL' | 'SELF_PICKUP' | 'SELLER_MANAGED';
        this.logger.log(`Inheriting logistics preference from order: ${logisticsMode}`);
      } else if (sellerPref?.logisticsPreference) {
        const pref = sellerPref.logisticsPreference;
        if (pref.usePlatform3PL) {
          logisticsMode = LogisticsPreference.PLATFORM_3PL;
        } else if (pref.selfPickupAllowed) {
          logisticsMode = LogisticsPreference.SELF_PICKUP;
        } else {
          logisticsMode = LogisticsPreference.PLATFORM_3PL;
        }
      } else {
        logisticsMode = LogisticsPreference.PLATFORM_3PL;
      }
    }

    // Check if the requested mode is compatible with the order's negotiated mode
    if (order.logisticsPreference && logisticsMode && order.logisticsPreference !== logisticsMode) {
      this.logger.warn(`Shipment mode (${logisticsMode}) differs from Order negotiated mode (${order.logisticsPreference})`);
      // We still allow it if explicitly changed, but let's log it for audit.
    }

    let carrierId = dto.carrierId;

    if (logisticsMode === LogisticsPreference.SELF_PICKUP || logisticsMode === LogisticsPreference.SELLER_MANAGED) {
      carrierId = undefined; // No platform carrier for self-pickup or seller-managed
      this.logger.log(`Handling as ${logisticsMode} for order: ${dto.orderId}`);
    } else {
      // Platform 3PL path
      if (!carrierId) {
        throw new Error(`A Carrier (3PL) must be selected for Platform Logistics. If you want to use Buyer Self-Pickup, please select that mode explicitly.`);
      }
    }

    const shipmentId = `SHP-${Date.now()}`;
    const shipment = new this.shipmentModel({
      ...dto,
      transitDays: dto.transitDays, 
      product: {
        category: order.product.category,
        grade: order.product.grade,
        quantityMT: order.product.quantityMT,
      },
      sellerId,
      buyerId: order.buyerId,
      carrierId,
      logisticsMode,
      shipmentId,
      status: "PICKUP_PLANNED",
      createdAt: new Date(),
    });
    const savedShipment = await shipment.save();

    await this.ordersService.registerShipment(dto.orderId, savedShipment._id as any);

    this.auditService.log({
      action: AuditAction.SHIPMENT_CREATED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: savedShipment._id as any,
      entityIdStr: savedShipment.shipmentId,
      actorId: sellerId,
      afterState: { shipmentId: savedShipment.shipmentId, orderId: dto.orderId, status: 'PICKUP_PLANNED' },
      description: `Shipment ${savedShipment.shipmentId} created for Order ${dto.orderId}`,
    });

    return savedShipment;
  }

  async findAll(filters = {}, page = 1, limit = 20) {
    this.logger.log(`Fetching all shipments with filters: ${JSON.stringify(filters)}`);
    return this.shipmentModel
      .find(filters)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findByBuyerId(buyerId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel.find({ buyerId, ...filters }).skip((page - 1) * limit).limit(limit);
  }

  async findBySellerId(sellerId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel.find({ sellerId, ...filters }).skip((page - 1) * limit).limit(limit);
  }

  async findByCarrierId(carrierId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel.find({ carrierId, ...filters }).skip((page - 1) * limit).limit(limit);
  }

  async findByIdOrFail(id: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    return shipment;
  }

  async findByOrderId(orderId: string) {
    return this.shipmentModel.findOne({ orderId: new Types.ObjectId(orderId) });
  }


  async addMilestone(id: string, dto: UpdateMilestoneDto) {
    this.logger.log(`Adding milestone: ${dto.event} to shipment: ${id}`);
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.milestones.push({
      eventId: `EVT-${Date.now()}`,
      event: dto.event,
      timestamp: new Date(dto.timestamp),
      location: dto.location || "",
      notes: dto.notes || "",
    });
    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.MILESTONE_ADDED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      afterState: { event: dto.event, location: dto.location, timestamp: dto.timestamp },
      actorType: 'USER',
      description: `Milestone '${dto.event}' added for Shipment ${saved.shipmentId}`,
    });

    return saved;
  }

  async uploadDocument(id: string, dto: UploadDocumentDto, userId: string, userRole?: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.documents.push({
      docId: `DOC-${Date.now()}`,
      docType: dto.docType,
      fileUrl: dto.fileUrl,
      fileHash: "",
      uploadedAt: new Date(),
      uploadedBy: userId,
      uploadedByRole: userRole || 'UNKNOWN',
      verified: false,
    });
    await shipment.save();

    // Payout trigger removed from here; now gated by Admin verification of LR.

    this.auditService.log({
      action: AuditAction.DOCUMENT_UPLOADED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: shipment._id as any,
      entityIdStr: shipment.shipmentId,
      actorId: userId,
      afterState: { docType: dto.docType, fileUrl: dto.fileUrl },
      description: `Document '${dto.docType}' uploaded for Shipment ${shipment.shipmentId}`,
    });

    return shipment;
  }

  async uploadDocumentMultipart(id: string, docType: string, file: Express.Multer.File, userId: string, userRole?: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    // Clean up existing document of the same type if it exists (Replacement)
    const existingIndex = shipment.documents.findIndex(d => d.docType === docType);
    if (existingIndex > -1) {
      const existingDoc = shipment.documents[existingIndex];
      if (existingDoc.fileUrl) {
        try {
          await this.fileStorageService.deleteFile({ fileUrl: existingDoc.fileUrl });
        } catch (err) {
          this.logger.warn(`Failed to delete old file for replacement: ${err.message}`);
        }
      }
      shipment.documents.splice(existingIndex, 1);
    }

    // Modern Neutral Path: uploads/shipments/[shipmentId]/[docType]/
    const folder = `shipments/${shipment.shipmentId}/${docType}`;
    const fileUrl = await this.fileStorageService.uploadFile({
      file: file.buffer,
      fileName: file.originalname,
      mimeType: file.mimetype,
      folder
    });

    const docId = `DOC-${Date.now()}`;
    const newDoc = {
      docId,
      docType,
      fileName: file.originalname,
      fileUrl,
      uploadedAt: new Date(),
      uploadedBy: userId,
      uploadedByRole: userRole || 'UNKNOWN',
      verified: false,
    };

    shipment.documents.push(newDoc);
    const saved = await shipment.save();

    // Trigger Stage 1 release if LR is uploaded OR Weighbridge uploaded for self-pickup
    // Payout trigger removed from here; moving to Admin verification gate for LR.

    this.auditService.log({
      action: AuditAction.DOCUMENT_UPLOADED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: userId,
      afterState: { docId, docType, fileUrl, fileName: file.originalname },
      description: `Document '${docType}' (${file.originalname}) uploaded for Shipment ${saved.shipmentId}`,
    });

    return saved;
  }

  async deleteDocument(id: string, docId: string, userId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    const docIndex = shipment.documents.findIndex(d => d.docId === docId);
    if (docIndex === -1) throw new NotFoundException("Document not found");

    const doc = shipment.documents[docIndex];

    // Delete physical file
    if (doc.fileUrl) {
      try {
        await this.fileStorageService.deleteFile({ fileUrl: doc.fileUrl });
      } catch (err) {
        this.logger.warn(`Failed to delete physical file during removal: ${err.message}`);
      }
    }

    // Remove from DB
    shipment.documents.splice(docIndex, 1);
    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.DOCUMENT_DELETED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: userId,
      beforeState: { docId, docType: doc.docType },
      description: `Document '${doc.docType}' removed from Shipment ${saved.shipmentId}`,
    });

    return saved;
  }

  async uploadPOD(id: string, body: { receiverName: string; podPhotos: string[] }) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.pod = {
      status: "UPLOADED",
      deliveryTimestamp: new Date(),
      ...body,
    };
    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.POD_UPLOADED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      afterState: { receiverName: body.receiverName, photoCount: body.podPhotos.length },
      description: `Proof of Delivery uploaded for Shipment ${saved.shipmentId}`,
    });

    return saved;
  }

  async markDelivered(id: string) {
    this.logger.log(`Marking shipment as delivered: ${id}`);
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    const prevStatus = shipment.status;
    shipment.status = "DELIVERED";
    shipment.statusTimeline.push({ status: "DELIVERED", timestamp: new Date() });

    const saved = await shipment.save();

    // Initialize 48h settlement timer on order
    try {
      await this.ordersService.initiateSettlementTimer(shipment.orderId.toString());
    } catch (err) {
      this.logger.error(`Failed to initiate settlement timer for order ${shipment.orderId}: ${err.message}`);
    }

    this.auditService.log({
      action: AuditAction.SHIPMENT_DELIVERED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      beforeState: { status: prevStatus },
      afterState: { status: 'DELIVERED' },
      changedFields: ['status'],
      actorType: 'USER',
      description: `Shipment ${saved.shipmentId} marked DELIVERED`,
    });

    return saved;
  }

  async getTracking(id: string) {
    const shipment = await this.shipmentModel.findById(id).select("milestones pod status delivery");
    if (!shipment) throw new NotFoundException("Shipment not found");
    return shipment;
  }

  async verifyDocument(id: string, docId: string, adminId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    const doc = shipment.documents.find((d) => d.docId === docId);
    if (!doc) throw new NotFoundException("Document not found");
    doc.verified = true;
    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.DOCUMENT_UPLOADED, // reuse — or you could define DOCUMENT_VERIFIED
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: adminId,
      afterState: { docId, verified: true },
      description: `Document ${docId} verified for Shipment ${saved.shipmentId}`,
    });

    // BUSINESS LOGIC: If LR or Weighbridge Slip is verified, release 80% payout
    if (doc.docType === 'LORRY_RECEIPT' || doc.docType === 'WEIGHBRIDGE_SLIP') {
      try {
        saved.status = 'LR_VERIFIED';
        saved.statusTimeline.push({ status: 'LR_VERIFIED', timestamp: new Date() });
        await saved.save();

        await this.paymentsService.releaseStage1(saved.orderId.toString());
        await this.ordersService.updateStatus(saved.orderId.toString(), 'IN_TRANSIT');
      } catch (err) {
        this.logger.error(`Failed to release Stage 1 after LR verification: ${err.message}`);
      }
    }

    return saved;
  }

  async updateStatus(id: string, status: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    const prevStatus = shipment.status;
    shipment.status = status;
    shipment.statusTimeline.push({ status: status, timestamp: new Date() });

    // Sync with order if needed
    if (status === 'PICKUP_CONFIRMED' || status === 'IN_TRANSIT') {
      await this.ordersService.updateStatus(shipment.orderId.toString(), 'IN_TRANSIT');
    }

    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.SHIPMENT_STATUS_CHANGED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      beforeState: { status: prevStatus },
      afterState: { status },
      changedFields: ['status'],
      actorType: 'USER',
      description: `Shipment ${saved.shipmentId} status updated to ${status}`,
    });

    return saved;
  }

  async downloadDocument(id: string, docId: string, user: any) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    // Strict Permissions: Only Seller, Buyer, Carrier, or Admin
    const isSeller = shipment.sellerId.toString() === user.organizationId;
    const isBuyer = shipment.buyerId.toString() === user.organizationId;
    const isCarrier = shipment.carrierId?.toString() === user.organizationId;
    const isAdmin = user.role === 'ADMIN';

    // PRIVACY GATE: If status is Pre-Dispatch, ONLY the Seller can see them.
    const isPreDispatch = ['PICKUP_PLANNED', 'PICKUP_CONFIRMED'].includes(shipment.status);
    
    if (isPreDispatch && !isSeller && !isAdmin) {
      this.logger.warn(`Unauthorized PRE-DISPATCH access attempt: ${docId} by user: ${user.id} (Role: ${user.role})`);
      throw new Error("Access Denied: Documents are locked until the shipment is formally Dispatched (IN_TRANSIT)");
    }

    if (!isSeller && !isBuyer && !isCarrier && !isAdmin) {
      this.logger.warn(`Unauthorized access attempt for shipment doc: ${docId} by user: ${user.id}`);
      throw new Error("Access Denied: You are not authorized to view this document");
    }

    const doc = shipment.documents.find(d => d.docId === docId);
    if (!doc || !doc.fileUrl) throw new NotFoundException("Document not found");

    // Read physical file
    const fileBuffer = await this.fileStorageService.readFileSecure({
      fileUrl: doc.fileUrl,
      organizationId: '' // The secure check is already done above for shipments
    }).catch(() => {
        // Fallback for neutral path
        const storagePath = path.join(process.cwd(), "uploads", doc.fileUrl.replace("/documents/", ""));
        return fs.readFileSync(storagePath);
    });

    const fileName = doc.fileName || doc.fileUrl.split('/').pop() || "document";
    const ext = fileName.toLowerCase().split('.').pop();
    
    return {
      buffer: fileBuffer,
      fileName,
      mimeType: this.getMimeType(ext),
    };
  }

  async confirmDispatch(id: string, userId: string, organizationId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    const order = await this.ordersService.findByIdOrFail(shipment.orderId.toString());

    // ✅ Strict Guardrail: Block dispatch if logistics not confirmed for 3PL
    if (shipment.logisticsMode === LogisticsPreference.PLATFORM_3PL) {
      if (order.status !== OrderStatus.LOGISTICS_ACCEPTED) {
        throw new BadRequestException('Dispatch blocked: Waiting for logistics provider to accept the job commitment.');
      }
    }

    // Only Seller or Logistics can confirm dispatch
    const isSeller = shipment.sellerId.toString() === organizationId;
    const isCarrier = shipment.carrierId?.toString() === organizationId;

    if (!isSeller && !isCarrier) {
      throw new BadRequestException("Access Denied: Only the Seller or Logistic Provider can confirm dispatch");
    }


    const prevStatus = shipment.status;
    shipment.status = 'DISPATCH_CONFIRMED';
    shipment.statusTimeline.push({ status: 'DISPATCH_CONFIRMED', timestamp: new Date() });

    // Note: Order status remains in current state until Admin verifies LR

    const saved = await shipment.save();

    this.auditService.log({
      action: AuditAction.SHIPMENT_DISPATCHED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: 'DISPATCH_CONFIRMED' },
      description: `Shipment ${saved.shipmentId} formally DISPATCHED and documents unlocked.`,
    });

    return saved;
  }

  // ─── Shipment RFQ & Bidding ───────────────────────────────

  async createShipmentRfq(orderId: string) {
    const order = await this.ordersService.findByIdOrFail(orderId);
    if (order.logisticsPreference !== LogisticsPreference.PLATFORM_3PL) {
      this.logger.warn(`Order ${orderId} does not have PLATFORM_3PL logistics preference. Skipping SRFQ creation.`);
      return;
    }

    const existing = await this.shipmentRfqModel.findOne({ orderId });
    if (existing) return existing;

    // Fetch Seller's Origin PIN
    // Priority: Order.pickupPin > Org.registeredAddress regex
    let originPin = order.pickupPin || "000000";
    
    if (originPin === "000000") {
      try {
        const sellerOrg = await this.organizationsService.getOrganization(order.sellerId.toString());
        if (sellerOrg?.orgKyc?.registeredAddress) {
          const pinMatch = sellerOrg.orgKyc.registeredAddress.match(/\b\d{6}\b/);
          if (pinMatch) originPin = pinMatch[0];
        }
      } catch (err) {
        this.logger.warn(`Could not determine origin PIN for seller ${order.sellerId}: ${err.message}`);
      }
    }

    const rfqId = `SRFQ-${Date.now()}`;
    const srfq = new this.shipmentRfqModel({
      rfqId,
      orderId: order._id,
      originPin,
      destinationPin: order.deliveryPin,
      materialDetails: {
        category: order.product.category,
        grade: order.product.grade,
        quantityMT: order.product.quantityMT,
      },
      expectedPickupDate: order.deliveryBy,
      status: 'OPEN',
    });

    const saved = await srfq.save();
    this.logger.log(`Created Shipment RFQ: ${saved.rfqId} for Order: ${orderId}`);

    this.auditService.log({
      action: AuditAction.SHIPMENT_RFQ_CREATED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT_RFQ,
      entityId: saved._id as any,
      entityIdStr: saved.rfqId,
      afterState: { rfqId: saved.rfqId, orderId },
      description: `Shipment RFQ ${saved.rfqId} created for Order ${orderId}`,
    });

    return saved;
  }

  async findAllOpenRfqs() {
    return this.shipmentRfqModel.aggregate([
      { $match: { status: ShipmentRfqStatus.OPEN } },
      {
        $lookup: {
          from: 'orders',
          localField: 'orderId',
          foreignField: '_id',
          as: 'order',
        },
      },
      { $unwind: '$order' },
      {
        $lookup: {
          from: 'shipmentbids',
          localField: '_id',
          foreignField: 'srfqId',
          as: 'bids',
        },
      },
      {
        $project: {
          _id: 1,
          srfqId: 1,
          orderId: 1,
          humanOrderId: '$order.orderId',
          materialDetails: 1,
          originPin: 1,
          destinationPin: 1,
          quantityMT: 1,
          status: 1,
          pickupAt: 1,
          bidCount: { $size: '$bids' },
          createdAt: 1,
        },
      },
      {
        $addFields: {
          lowestBid: { $min: '$bids.amount' },
        },
      },
      { $project: { bids: 0 } },
      { $sort: { createdAt: -1 } },
    ]);
  }


  async findBidsByRfq(rfqId: string) {
    return this.shipmentBidModel.find({ srfqId: new Types.ObjectId(rfqId) }).sort({ amount: 1 });
  }

  async submitBid(rfqId: string, carrierId: string, dto: { amount: number; transitTimeDays: number; vehicleType: string; notes?: string }) {
    const rfq = await this.shipmentRfqModel.findById(rfqId);
    if (!rfq) throw new NotFoundException('Shipment RFQ not found');
    if (rfq.status !== 'OPEN') throw new BadRequestException('This RFQ is no longer open for bids');

    const carrier = await this.organizationsService.getOrganization(carrierId);
    if (!carrier) throw new NotFoundException('Carrier organization not found');

    const bid = new this.shipmentBidModel({
      srfqId: rfq._id,
      carrierId,
      carrierName: carrier.legalName,
      ...dto,
      status: 'SUBMITTED',
    });

    const saved = await bid.save();

    this.auditService.log({
      action: AuditAction.SHIPMENT_BID_SUBMITTED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT_BID,
      entityId: saved._id as any,
      actorId: carrierId,
      description: `Bid of ₹${dto.amount} submitted by ${carrier.legalName} for SRFQ ${rfq.rfqId}`,
    });

    return saved;
  }

  /**
   * Awards a logistics bid to a carrier.
   * NOTE: This does NOT create a shipment anymore. It moves the process to a "Carrier Acceptance" phase.
   */
  async awardBid(rfqId: string, bidId: string, adminId: string) {
    this.logger.log(`Admin ${adminId} awarding Shipment RFQ ${rfqId} to bid ${bidId}`);
    
    const rfq = await this.shipmentRfqModel.findById(rfqId);
    if (!rfq) throw new NotFoundException('Shipment RFQ not found');
    if (rfq.status !== ShipmentRfqStatus.OPEN) throw new BadRequestException('RFQ is not open for awarding');
    
    const bid = await this.shipmentBidModel.findById(bidId);
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.srfqId.toString() !== rfqId) throw new BadRequestException('Bid does not belong to this RFQ');

    // 1. Update RFQ Status to AWARDED (Waiting for Carrier)
    rfq.status = ShipmentRfqStatus.AWARDED;
    rfq.winningBidId = bid._id as any;
    rfq.assignedCarrierId = bid.carrierId;
    rfq.awardedAt = new Date();
    
    // Set acceptance timeout (default: 4 hours)
    const timeoutHours = 4;
    const timeoutDate = new Date();
    timeoutDate.setHours(timeoutDate.getHours() + timeoutHours);
    rfq.acceptanceTimeout = timeoutDate;
    
    await rfq.save();

    // 2. Update Bid Status
    bid.status = 'AWARDED'; // Temporary status while waiting for acceptance
    await bid.save();

    // 3. Update Order Status
    const orderId = rfq.orderId.toString();
    await this.ordersService.updateStatus(orderId, OrderStatus.LOGISTICS_AWARDED);

    this.auditService.log({
      action: AuditAction.SHIPMENT_AWARDED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT_RFQ,
      entityId: rfq._id as any,
      entityIdStr: rfq.rfqId,
      actorId: adminId,
      afterState: { status: ShipmentRfqStatus.AWARDED, carrierId: bid.carrierId, timeout: timeoutDate },
      description: `Shipment RFQ ${rfq.rfqId} awarded to ${bid.carrierName}. Waiting for acceptance until ${timeoutDate.toLocaleString()}.`,
    });

    // TODO: Trigger Notification to Carrier: "You have an incoming job! Please accept within 4h."

    return { rfq, status: 'AWARDED_PENDING_ACCEPTANCE', timeout: timeoutDate };
  }

  /**
   * Carrier explicitly accepts the awarded job.
   * This finally creates the physical Shipment record.
   */
  async acceptJob(rfqId: string, carrierId: string, dto: {
    vehicleNumber: string;
    vehicleType: string;
    driverName: string;
    driverMobile: string;
  }) {
    this.logger.log(`Carrier ${carrierId} accepting job for RFQ ${rfqId}`);
    
    const rfq = await this.shipmentRfqModel.findById(rfqId);
    if (!rfq) throw new NotFoundException('Shipment RFQ not found');
    if (rfq.status !== ShipmentRfqStatus.AWARDED) throw new BadRequestException('This job is not in AWARDED status');
    if (rfq.assignedCarrierId?.toString() !== carrierId) throw new BadRequestException('You are not the assigned carrier for this job');

    // Check timeout
    if (rfq.acceptanceTimeout && new Date() > rfq.acceptanceTimeout) {
      rfq.status = ShipmentRfqStatus.OPEN; // Re-open if expired? Or EXPIRED.
      await rfq.save();
      throw new BadRequestException('Acceptance window has expired. Please contact admin.');
    }

    const bid = await this.shipmentBidModel.findById(rfq.winningBidId);
    if (!bid) throw new Error('Winning bid record lost');

    // 1. Finalize RFQ & Bid
    rfq.status = ShipmentRfqStatus.ASSIGNED;
    await rfq.save();

    bid.status = 'ACCEPTED';
    await bid.save();

    // Reject other bids for this RFQ
    await this.shipmentBidModel.updateMany(
      { srfqId: rfq._id, _id: { $ne: bid._id } },
      { status: 'REJECTED' }
    );

    // 2. Create the ACTUAL Shipment record now
    const orderId = rfq.orderId.toString();
    const order = await this.ordersService.findByIdOrFail(orderId);
    const shipmentId = `SHP-${Date.now()}`;
    
    let pickupPin = rfq.originPin; // Use the one from RFQ as it's the verified warehouse one
    
    const shipment = new this.shipmentModel({
      shipmentId,
      orderId: order._id,
      sellerId: order.sellerId,
      buyerId: order.buyerId,
      carrierId: new Types.ObjectId(carrierId),
      logisticsMode: LogisticsPreference.PLATFORM_3PL,
      product: order.product,
      pickup: {
        location: 'Seller Warehouse',
        pin: pickupPin,
      },
      delivery: {
        location: order.deliveryCity || 'Buyer Location',
        pin: order.deliveryPin,
        city: order.deliveryCity || 'N/A',
        state: order.deliveryState || 'N/A',
        scheduledAt: order.deliveryBy,
      },
      vehicle: {
        vehicleNumber: dto.vehicleNumber,
        vehicleType: dto.vehicleType,
        driverName: dto.driverName,
        driverMobile: dto.driverMobile,
      },
      pricing: {
        freightAmount: bid.amount,
        currency: 'INR'
      },
      transitDays: bid.transitTimeDays,
      status: 'PICKUP_PLANNED'
    });

    const savedShipment = await shipment.save();
    
    // Register shipment with order
    await this.ordersService.registerShipment(orderId, savedShipment._id as any);
    
    // 3. Move Order to LOGISTICS_ACCEPTED
    await this.ordersService.updateStatus(orderId, OrderStatus.LOGISTICS_ACCEPTED);

    this.auditService.log({
      action: AuditAction.SHIPMENT_CREATED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: savedShipment._id as any,
      entityIdStr: savedShipment.shipmentId,
      actorId: carrierId,
      description: `Carrier ${bid.carrierName} accepted the job. Shipment ${savedShipment.shipmentId} created.`,
    });

    return savedShipment;
  }

  /**
   * Carrier rejects the awarded job.
   */
  async rejectJob(rfqId: string, carrierId: string, reason: string) {
    this.logger.log(`Carrier ${carrierId} REJECTING job for RFQ ${rfqId}. Reason: ${reason}`);
    
    const rfq = await this.shipmentRfqModel.findById(rfqId);
    if (!rfq) throw new NotFoundException('Shipment RFQ not found');
    if (rfq.status !== ShipmentRfqStatus.AWARDED) throw new BadRequestException('This job is not in AWARDED status');
    if (rfq.assignedCarrierId?.toString() !== carrierId) throw new BadRequestException('You are not the assigned carrier for this job');

    // 1. Reset RFQ to OPEN so others can bid or Admin can re-award
    rfq.status = ShipmentRfqStatus.OPEN;
    rfq.winningBidId = undefined;
    rfq.assignedCarrierId = undefined;
    rfq.rejectionReason = reason;
    await rfq.save();

    // 2. Mark the bid as REJECTED
    await this.shipmentBidModel.findOneAndUpdate(
      { srfqId: rfq._id, carrierId },
      { status: 'REJECTED_BY_CARRIER' }
    );

    // 3. Reset Order Status back to DISPATCH_PREP
    await this.ordersService.updateStatus(rfq.orderId.toString(), OrderStatus.DISPATCH_PREP);

    this.auditService.log({
      action: AuditAction.SHIPMENT_BID_SUBMITTED, // Reuse or add SHIPMENT_REJECTED
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT_RFQ,
      entityId: rfq._id as any,
      actorId: carrierId,
      description: `Carrier rejected the job award. Reason: ${reason}. RFQ re-opened for bidding.`,
    });

    return { status: 'REOPENED', rfq };
  }


  private getMimeType(ext?: string): string {
    const map = {
      pdf: "application/pdf",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      txt: "text/plain",
    };
    return map[ext as keyof typeof map] || "application/octet-stream";
  }
}
