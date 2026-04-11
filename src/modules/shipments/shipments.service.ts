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
import { UsersService } from "../users/services/users.service";
import {
  AuditAction,
  AuditModule,
  AuditEntityType,
  LogisticsPreference
} from "src/common/constants/app.constants";
import {
  ShipmentRfqStatus,
  OrderStatus,
  ShipmentBidStatus
} from "@common/enums";

import { SellerPreference, SellerPreferenceDocument } from "../preferences/schemas/seller-preference.schema";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";
import { OrganizationsService } from "../organizations/organizations.service";
import { NotificationsService } from "../notifications/notifications.service";
import { IdGeneratorService } from "src/common/services/id-generator.service";

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
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly idGenerator: IdGeneratorService,
    private readonly logger: CustomLoggerService,
  ) { }

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
      // ✅ BUG FIX: Block manual shipment creation for PLATFORM_3PL orders.
      // The Shipment is created automatically when the carrier accepts the job (acceptJob).
      throw new BadRequestException(
        'Cannot manually create a shipment for PLATFORM_3PL orders. ' +
        'The shipment record is created automatically when the carrier accepts the awarded job. ' +
        'Use the Load Board flow: Mark Ready → RFQ → Bid → Award → Accept.'
      );
    }

    const sellerOrg = await this.organizationsService.getOrganization(sellerId);
    const shipmentId = this.idGenerator.generateBusinessId('SHP', sellerOrg?.orgCode);
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
      eventId: this.idGenerator.generateBusinessId('EVT'),
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
      docId: this.idGenerator.generateBusinessId('DOC'),
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

    const docId = this.idGenerator.generateBusinessId('DOC');
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

    // ✅ TERM-AWARE TIMER: Only start 48h settlement timer if there's an unreleased Stage 2
    // - 80/20: Stage 2 (20%) is still escrowed at this point — start timer
    // - 100%: Stage 2 amount = ₹0 — skip timer
    // - 50/50: Stage 2 was already released at LR verification — skip timer
    try {
      const payment = await this.paymentsService.findByOrderId(shipment.orderId.toString());
      const needsTimer = 
        payment && 
        payment.escrowStage2Amount > 0 && 
        payment.escrowStage2Status !== 'RELEASED';

      if (needsTimer) {
        await this.ordersService.initiateSettlementTimer(shipment.orderId.toString());
      } else {
        // Still mark the order as DELIVERED even without the timer
        await this.ordersService.updateStatus(shipment.orderId.toString(), 'DELIVERED');
        this.logger.log(`Skipping 48h timer for order ${shipment.orderId}: no unreleased Stage 2 payment (s2Amount=${payment?.escrowStage2Amount}, s2Status=${payment?.escrowStage2Status})`);
      }
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

    // Notify Seller
    try {
      const sellerUsers = await this.organizationsService.getOrganizationUsers(saved.sellerId.toString());
      for (const user of sellerUsers) {
        await this.notificationsService.notify(
          (user as any)._id.toString(),
          'Shipment Delivered',
          `Material for Order #${saved.orderId} has been marked as Delivered.`,
          {
            template: 'order-status',
            data: {
              orderId: saved.orderId,
              status: 'DELIVERED',
              userName: user.firstName,
              orderUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/seller/orders/${saved.orderId}`,
            }
          }
        ).catch(e => this.logger.error(`Failed to notify seller user ${user._id}: ${e.message}`));
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch delivery notifications to seller: ${err.message}`);
    }

    // Notify Buyer (Verification Prompt)
    try {
      const buyerUsers = await this.usersService.findByOrgId(saved.buyerId.toString());
      for (const user of buyerUsers) {
        await this.notificationsService.notify(
          (user as any)._id.toString(),
          'Shipment Delivered - Action Required',
          `The shipment for Order #${saved.orderId} has reached. Please verify and accept.`,
          {
            template: 'delivery-verification',
            data: {
              orderId: saved.orderId,
              vehicleNumber: (saved as any).vehicle?.vehicleNumber || 'Tracked Vehicle',
              ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/orders/${saved.orderId}`,
            }
          }
        ).catch(e => this.logger.error(`Failed to notify buyer user ${(user as any)._id}: ${e.message}`));
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch delivery verification notifications: ${err.message}`);
    }

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

    // BUSINESS LOGIC: If LR or Weighbridge Slip is verified, release payout based on terms
    if (doc.docType === 'LORRY_RECEIPT' || doc.docType === 'WEIGHBRIDGE_SLIP') {
      try {
        saved.status = 'LR_VERIFIED';
        saved.statusTimeline.push({ status: 'LR_VERIFIED', timestamp: new Date() });
        await saved.save();

        const order = await this.ordersService.findByIdOrFail(saved.orderId.toString());
        if (order.paymentTerms === '50/50 Escrow (Advance/Loading)') {
          // Release Stage 2 (Remaining 50%) since Stage 1 was already released at payment verification
          await this.paymentsService.releaseStage2(saved.orderId.toString());
        } else {
          // Release Stage 1 (80% or 100%)
          await this.paymentsService.releaseStage1(saved.orderId.toString());
        }
        
        await this.ordersService.updateStatus(saved.orderId.toString(), 'IN_TRANSIT');
      } catch (err) {
        this.logger.error(`Failed to handle Loading payout after LR verification: ${err.message}`);
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

    // ✅ DOCUMENT GATE: LR must be uploaded before dispatch can be confirmed
    // Without an LR, the Admin has nothing to verify, and escrow cannot be released.
    const hasLR = shipment.documents.some(d =>
      d.docType === 'LORRY_RECEIPT' || d.docType === 'WEIGHBRIDGE_SLIP'
    );
    if (!hasLR) {
      throw new BadRequestException(
        'Dispatch blocked: Please upload the Lorry Receipt (LR) or Weighbridge Slip before confirming dispatch. ' +
        'These documents are required for escrow release verification.'
      );
    }

    const prevStatus = shipment.status;
    shipment.status = 'DISPATCH_CONFIRMED';
    shipment.statusTimeline.push({ status: 'DISPATCH_CONFIRMED', timestamp: new Date() });

    const saved = await shipment.save();

    // ✅ SYNC ORDER STATUS: Advance Order to DISPATCH_CONFIRMED so buyer tracker updates
    try {
      await this.ordersService.updateStatus(saved.orderId.toString(), OrderStatus.DISPATCH_CONFIRMED);
    } catch (err) {
      this.logger.error(`Failed to sync order status to DISPATCH_CONFIRMED: ${err.message}`);
    }

    this.auditService.log({
      action: AuditAction.SHIPMENT_DISPATCHED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT,
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: 'DISPATCH_CONFIRMED' },
      description: `Shipment ${saved.shipmentId} formally DISPATCHED. LR verified present. Order status synced to DISPATCH_CONFIRMED.`,
    });

    // Notify Buyer
    try {
      await this.notificationsService.notify(
        saved.buyerId.toString(),
        'Goods Dispatched!',
        `Your goods for Order #${saved.orderId} have been dispatched.`,
        {
          template: 'shipment-dispatched',
          data: {
            orderId: saved.orderId,
            productName: order.product?.category || 'Material',
            quantity: order.product?.quantityMT || 0,
            vehicleNumber: (saved as any).vehicle?.vehicleNumber || 'Pending',
            lrNumber: saved.documents?.find(d => d.docType === 'LORRY_RECEIPT')?.docId || 'N/A',
            eta: '2-4 Days',
            trackingUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/buyer/shipments/${saved._id}`,
          }
        }
      ).catch(e => this.logger.error(`Failed to notify buyer ${saved.buyerId}: ${e.message}`));
    } catch (err) {
      this.logger.error(`Failed to dispatch dispatch notifications: ${err.message}`);
    }

    return saved;
  }


  // ─── Shipment RFQ & Bidding ───────────────────────────────

  async createShipmentRfq(orderId: string) {
    const order = await this.ordersService.findByIdOrFail(orderId);
    if (order.logisticsPreference !== LogisticsPreference.PLATFORM_3PL) {
      this.logger.warn(`Order ${orderId} does not have PLATFORM_3PL logistics preference. Skipping SRFQ creation.`);
      return;
    }

    const existing = await this.shipmentRfqModel.findOne({ orderId: new Types.ObjectId(orderId) });
    if (existing) {
      this.logger.warn(`Shipment RFQ already exists for order ${orderId}: ${existing.rfqId}`);
      return existing;
    }

    // Fetch Seller's Origin PIN
    // Priority: Order.pickupPin > Org.registeredAddress regex
    if (!order.pickupPin || !order.deliveryPin) {
      this.logger.error(`CRITICAL: Missing PINs for Order ${orderId}. Pickup: ${order.pickupPin}, Delivery: ${order.deliveryPin}`);
      // In a fresh project, we want to know immediately if the flow is broken.
    }

    const buyerOrg = await this.organizationsService.getOrganization(order.buyerId.toString());
    const rfqId = this.idGenerator.generateBusinessId('SRFQ', buyerOrg?.orgCode);
    const srfq = new this.shipmentRfqModel({
      rfqId,
      orderId: order._id,
      originPin: order.pickupPin || '000000', // Keep a safe default for schema required:true but log error above
      destinationPin: order.deliveryPin || '000000',
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

  async findAllOpenRfqs(carrierId?: string) {
    this.logger.log(`[BASE] Searching OPEN RFQs. Carrier Context: ${carrierId || 'NONE'}`);
    
    // Core pipeline designed to be robust against missing joins or type mismatches
    const pipeline: any[] = [
      { $match: { status: ShipmentRfqStatus.OPEN } },
      // 1. Join Order context
      {
        $lookup: {
          from: 'orders',
          let: { orderId: '$orderId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$orderId' }] } } }
          ],
          as: 'order_context'
        }
      },
      // 2. Join Bids for count and "hasMyBid" detection
      {
        $lookup: {
          from: 'shipmentbids',
          let: { rfqId: '$_id' },
          pipeline: [
            { $match: { $expr: { $eq: ['$srfqId', '$$rfqId'] } } }
          ],
          as: 'all_bids'
        }
      },
      // 3. Project to flattened format
      {
        $project: {
          _id: 1,
          rfqId: 1,
          orderId: 1,
          // Robust mapping from order_context
          humanOrderId: { $ifNull: [{ $arrayElemAt: ['$order_context.orderId', 0] }, 'N/A'] },
          sellerOrgName: { $ifNull: [{ $arrayElemAt: ['$order_context.sellerOrgName', 0] }, 'Generic Seller'] },
          buyerOrgName: { $ifNull: [{ $arrayElemAt: ['$order_context.buyerOrgName', 0] }, 'Generic Buyer'] },
          originPin: 1,
          destinationPin: 1,
          materialDetails: 1,
          status: 1,
          expectedPickupDate: 1,
          createdAt: 1,
          bidCount: { $size: '$all_bids' },
          lowestBid: { $min: '$all_bids.amount' },
          // Check if the current carrier has a bid here
          hasMyBid: carrierId ? {
            $gt: [
              {
                $size: {
                  $filter: {
                    input: '$all_bids',
                    as: 'b',
                    cond: { $eq: [{ $toString: '$$b.carrierId' }, carrierId.toString()] }
                  }
                }
              },
              0
            ]
          } : { $literal: false }
        }
      },
      { $sort: { createdAt: -1 } }
    ];

    const results = await this.shipmentRfqModel.aggregate(pipeline);
    this.logger.log(`[BASE] Returned ${results.length} open market loads.`);
    return results;
  }

  async findAllAwardedRfqs(carrierId?: string) {
    this.logger.log(`[BASE] Searching AWARDED jobs. Carrier Identity: ${carrierId || 'ADMIN'}`);
    
    // Status filter
    const matchFilters: any = {
      status: { $in: [ShipmentRfqStatus.AWARDED, ShipmentRfqStatus.ASSIGNED] }
    };

    const pipeline: any[] = [
      { $match: matchFilters },
      // 1. Join Order context with robust ID mapping
      {
        $lookup: {
          from: 'orders',
          let: { orderId: '$orderId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$orderId' }] } } }
          ],
          as: 'ord_ctx'
        }
      },
      // 2. Join Winning Bid context
      {
        $lookup: {
          from: 'shipmentbids',
          let: { bidId: '$winningBidId' },
          pipeline: [
            { $match: { $expr: { $eq: ['$_id', { $toObjectId: '$$bidId' }] } } }
          ],
          as: 'bid_ctx'
        }
      },
      // 3. Flatten and calculate
      {
        $project: {
          _id: 1,
          rfqId: 1,
          orderId: 1,
          status: 1,
          originPin: 1,
          destinationPin: 1,
          materialDetails: 1,
          awardedAt: 1,
          createdAt: 1,
          expectedPickupDate: 1,
          humanOrderId: { $ifNull: [{ $arrayElemAt: ['$ord_ctx.orderId', 0] }, 'N/A'] },
          sellerOrgName: { $ifNull: [{ $arrayElemAt: ['$ord_ctx.sellerOrgName', 0] }, 'Seller N/A'] },
          buyerOrgName: { $ifNull: [{ $arrayElemAt: ['$ord_ctx.buyerOrgName', 0] }, 'Buyer N/A'] },
          winningBid: { $arrayElemAt: ['$bid_ctx', 0] },
          // Carrier permission check (string based)
          isAwardedToMe: carrierId 
            ? { $eq: [{ $toString: '$assignedCarrierId' }, carrierId.toString()] }
            : { $literal: true } 
        }
      },
      // 4. Final filter for the specific carrier if not admin
      ...(carrierId ? [{
          $match: { isAwardedToMe: true }
      }] : []),
      { $sort: { awardedAt: -1 } }
    ];

    const results = await this.shipmentRfqModel.aggregate(pipeline);
    this.logger.log(`[BASE] Found ${results.length} awarded contracts.`);
    return results;
  }


  async findBidsByRfq(rfqId: string) {
    return this.shipmentBidModel.find({ srfqId: new Types.ObjectId(rfqId) }).sort({ amount: 1 });
  }

  async submitBid(rfqId: string, carrierId: string, dto: { amount: number; transitTimeDays: number; vehicleType: string; notes?: string }) {
    const rfq = await this.shipmentRfqModel.findById(rfqId);
    if (!rfq) throw new NotFoundException('Shipment RFQ not found');
    if (rfq.status !== ShipmentRfqStatus.OPEN) throw new BadRequestException('This RFQ is no longer open for bids');

    // Check for existing bid
    const existingBid = await this.shipmentBidModel.findOne({ srfqId: rfq._id, carrierId: new Types.ObjectId(carrierId) });
    if (existingBid) {
      // For now, let's block duplicate bids. In future, we could allow updates.
      throw new BadRequestException('You have already submitted a bid for this RFQ.');
    }

    const carrier = await this.organizationsService.getOrganization(carrierId);
    if (!carrier) throw new NotFoundException('Carrier organization not found');

    this.logger.log(`[DEBUG] Received bid submission: ${JSON.stringify(dto)}`);

    const bid = new this.shipmentBidModel({
      srfqId: rfq._id,
      carrierId: new Types.ObjectId(carrierId),
      carrierName: carrier.legalName,
      amount: dto.amount,
      transitTimeDays: dto.transitTimeDays,
      vehicleType: dto.vehicleType,
      notes: dto.notes,
      status: ShipmentBidStatus.SUBMITTED,
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

    // ✅ ORDER STATUS GUARD: Ensure the order is in DISPATCH_PREP before awarding logistics.
    // This prevents awarding a bid on an order that hasn't had material confirmed ready yet.
    const orderForGuard = await this.ordersService.findByIdOrFail(rfq.orderId.toString());
    if (orderForGuard.status !== OrderStatus.DISPATCH_PREP) {
      throw new BadRequestException(
        `Cannot award bid: Order is in '${orderForGuard.status}' status, expected DISPATCH_PREP. ` +
        `The Seller must mark material as ready before logistics can be awarded.`
      );
    }

    const bid = await this.shipmentBidModel.findById(bidId);
    if (!bid) throw new NotFoundException('Bid not found');
    if (bid.srfqId.toString() !== rfqId) throw new BadRequestException('Bid does not belong to this RFQ');

    this.logger.log(`[DEBUG] Awarding RFQ ${rfqId} to Bid ${bidId}. Carrier: ${bid.carrierId} (${bid.carrierName})`);

    // 1. Update RFQ Status to AWARDED (Waiting for Carrier)
    rfq.status = ShipmentRfqStatus.AWARDED;
    rfq.winningBidId = new Types.ObjectId(bid._id as string);
    rfq.assignedCarrierId = new Types.ObjectId(bid.carrierId as any);
    rfq.awardedAt = new Date();

    this.logger.log(`RFQ ${rfqId} assigned to carrier ${bid.carrierId} (${bid.carrierName})`);

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

    // ✅ GAP FIX: Notify the winning carrier that they have been awarded a job
    try {
      const carrierUsers = await this.organizationsService.getOrganizationUsers(bid.carrierId.toString());
      for (const user of carrierUsers) {
        await this.notificationsService.notify(
          (user as any)._id.toString(),
          '🏆 Job Awarded — Action Required',
          `You have been awarded the logistics job for SRFQ ${rfq.rfqId}. Please accept within 4 hours.`,
          {
            template: 'job-awarded',
            data: {
              rfqId: rfq.rfqId,
              rfqMongoId: rfq._id,
              originPin: rfq.originPin,
              destinationPin: rfq.destinationPin,
              acceptanceDeadline: timeoutDate.toLocaleString(),
              ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/logistics/assignments`,
            }
          }
        ).catch(e => this.logger.error(`Failed to notify carrier user ${(user as any)._id}: ${e.message}`));
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch award notifications to carrier: ${err.message}`);
    }

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

    // Status Guard
    if (rfq.status !== ShipmentRfqStatus.AWARDED) {
      this.logger.error(`Acceptance failed: RFC ${rfqId} is in status ${rfq.status}, expected AWARDED`);
      throw new BadRequestException(`This job is already in ${rfq.status} status`);
    }

    // Carrier Identity Guard
    if (rfq.assignedCarrierId?.toString() !== carrierId?.toString()) {
      this.logger.error(`Acceptance failed: Carrier mismatch. Expected ${rfq.assignedCarrierId}, got ${carrierId}`);
      throw new BadRequestException('You are not the assigned carrier for this job');
    }

    // Check timeout
    if (rfq.acceptanceTimeout && new Date() > rfq.acceptanceTimeout) {
      rfq.status = ShipmentRfqStatus.OPEN;
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
    const sellerOrg = await this.organizationsService.getOrganization(order.sellerId.toString());
    const shipmentId = this.idGenerator.generateBusinessId('SHP', sellerOrg?.orgCode);

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

    this.logger.log(`[DEBUG] Shipment created: ${savedShipment.shipmentId} for Order: ${orderId}`);

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
    rfq.reOpenCount = (rfq.reOpenCount || 0) + 1; // ✅ Track re-open count for Admin visibility
    await rfq.save();

    // 2. Mark the rejected bid using the proper enum value
    await this.shipmentBidModel.findOneAndUpdate(
      { srfqId: rfq._id, carrierId: new Types.ObjectId(carrierId) },
      { status: ShipmentBidStatus.REJECTED_BY_CARRIER }
    );

    // 3. Reset Order Status back to DISPATCH_PREP
    await this.ordersService.updateStatus(rfq.orderId.toString(), OrderStatus.DISPATCH_PREP);

    this.auditService.log({
      action: AuditAction.SHIPMENT_BID_SUBMITTED,
      module: AuditModule.SHIPMENT,
      entityType: AuditEntityType.SHIPMENT_RFQ,
      entityId: rfq._id as any,
      actorId: carrierId,
      description: `Carrier rejected the job award. Reason: ${reason}. RFQ re-opened for bidding (Re-open #${rfq.reOpenCount}).`,
    });

    // ✅ 4. Notify Admin: Carrier rejected — manual re-award required
    try {
      const adminUsers = await this.usersService.findAdmins();
      for (const adminUser of adminUsers) {
        await this.notificationsService.notify(
          (adminUser as any)._id.toString(),
          '⚠️ Carrier Rejected Job — Re-Award Required',
          `Carrier declined job for SRFQ ${rfq.rfqId} (Re-listed #${rfq.reOpenCount}). Reason: "${reason}". Please review bids and re-award.`,
          {
            template: 'admin-alert',
            data: {
              rfqId: rfq.rfqId,
              reason,
              reOpenCount: rfq.reOpenCount,
              ctaUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/admin/logistics`,
            }
          }
        ).catch(e => this.logger.error(`Failed to notify admin ${(adminUser as any)._id}: ${e.message}`));
      }
    } catch (err) {
      this.logger.error(`Failed to dispatch carrier-rejection admin notifications: ${err.message}`);
    }

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
