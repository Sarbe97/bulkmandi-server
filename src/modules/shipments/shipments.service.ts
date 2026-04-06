import { Injectable, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import * as path from "path";
import * as fs from "fs";
import { CustomLoggerService } from "src/core/logger/custom.logger.service";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { FileStorageService } from "src/core/file/services/file-storage.service";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { Shipment, ShipmentDocument } from "./schemas/shipment.schema";
import { SellerPreference, SellerPreferenceDocument } from "../preferences/schemas/seller-preference.schema";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @InjectModel(SellerPreference.name) private sellerPrefModel: Model<SellerPreferenceDocument>,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
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
          logisticsMode = 'PLATFORM_3PL';
        } else if (pref.selfPickupAllowed) {
          logisticsMode = 'SELF_PICKUP';
        } else {
          logisticsMode = 'PLATFORM_3PL';
        }
      } else {
        logisticsMode = 'PLATFORM_3PL';
      }
    }

    // Check if the requested mode is compatible with the order's negotiated mode
    if (order.logisticsPreference && logisticsMode && order.logisticsPreference !== logisticsMode) {
      this.logger.warn(`Shipment mode (${logisticsMode}) differs from Order negotiated mode (${order.logisticsPreference})`);
      // We still allow it if explicitly changed, but let's log it for audit.
    }

    let carrierId = dto.carrierId;

    if (logisticsMode === 'SELF_PICKUP' || logisticsMode === 'SELLER_MANAGED') {
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
      action: 'SHIPMENT_CREATED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'MILESTONE_ADDED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'DOCUMENT_UPLOADED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'DOCUMENT_UPLOADED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'DOCUMENT_DELETED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'POD_UPLOADED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'SHIPMENT_DELIVERED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'DOCUMENT_UPLOADED', // reuse — or you could define DOCUMENT_VERIFIED
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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
      action: 'SHIPMENT_STATUS_CHANGED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
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

    // Only Seller or Logistics can confirm dispatch
    const isSeller = shipment.sellerId.toString() === organizationId;
    const isCarrier = shipment.carrierId?.toString() === organizationId;

    if (!isSeller && !isCarrier) {
      throw new Error("Access Denied: Only the Seller or Logistic Provider can confirm dispatch");
    }

    const prevStatus = shipment.status;
    shipment.status = 'DISPATCH_CONFIRMED';
    shipment.statusTimeline.push({ status: 'DISPATCH_CONFIRMED', timestamp: new Date() });

    // Note: Order status remains in current state until Admin verifies LR

    const saved = await shipment.save();

    this.auditService.log({
      action: 'SHIPMENT_DISPATCHED',
      module: 'SHIPMENT',
      entityType: 'SHIPMENT',
      entityId: saved._id as any,
      entityIdStr: saved.shipmentId,
      actorId: userId,
      beforeState: { status: prevStatus },
      afterState: { status: 'DISPATCH_CONFIRMED' },
      description: `Shipment ${saved.shipmentId} formally DISPATCHED and documents unlocked.`,
    });

    return saved;
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
