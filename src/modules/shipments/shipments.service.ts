import { Injectable, NotFoundException, Inject, forwardRef } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditService } from "../audit/audit.service";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { Shipment, ShipmentDocument } from "./schemas/shipment.schema";
import { OrdersService } from "../orders/orders.service";
import { PaymentsService } from "../payments/payments.service";

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>,
    @Inject(forwardRef(() => OrdersService)) private readonly ordersService: OrdersService,
    @Inject(forwardRef(() => PaymentsService)) private readonly paymentsService: PaymentsService,
    private readonly auditService: AuditService,
  ) {}

  async create(sellerId: string, dto: CreateShipmentDto) {
    const order = await this.ordersService.findByIdOrFail(dto.orderId);
    if (order.sellerId.toString() !== sellerId) {
      throw new NotFoundException("Order not found or access denied");
    }

    const shipmentId = `SHP-${Date.now()}`;
    const shipment = new this.shipmentModel({
      ...dto,
      sellerId,
      buyerId: order.buyerId,
      carrierId: dto.carrierId,
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

  async uploadDocument(id: string, dto: UploadDocumentDto, userId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.documents.push({
      docId: `DOC-${Date.now()}`,
      docType: dto.docType,
      fileUrl: dto.fileUrl,
      fileHash: "",
      uploadedAt: new Date(),
      uploadedBy: userId,
      verified: false,
    });
    await shipment.save();

    if (dto.docType === 'LORRY_RECEIPT') {
      try {
        await this.paymentsService.releaseStage1(shipment.orderId.toString());
      } catch (err) {
        console.warn('Stage 1 escrow release failed:', err.message);
      }
    }

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
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");

    const prevStatus = shipment.status;
    shipment.status = "DELIVERED";
    shipment.statusTimeline.push({ status: "DELIVERED", timestamp: new Date() });

    await this.ordersService.updateStatus(shipment.orderId.toString(), 'DELIVERED');

    const saved = await shipment.save();

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

    return saved;
  }
}
