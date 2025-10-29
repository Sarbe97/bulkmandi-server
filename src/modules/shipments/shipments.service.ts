import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { CreateShipmentDto } from "./dto/create-shipment.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { UploadDocumentDto } from "./dto/upload-document.dto";
import { Shipment, ShipmentDocument } from "./schemas/shipment.schema";

@Injectable()
export class ShipmentsService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>
  ) {}

  async create(sellerId: string, dto: CreateShipmentDto) {
    const shipmentId = `SHP-${Date.now()}`;
    const shipment = new this.shipmentModel({
      ...dto,
      sellerId,
      shipmentId,
      status: "PICKUP_PLANNED",
      createdAt: new Date(),
    });
    return shipment.save();
  }

  async findByBuyerId(buyerId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel
      .find({ buyerId, ...filters })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findBySellerId(sellerId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel
      .find({ sellerId, ...filters })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findByCarrierId(carrierId: string, filters = {}, page = 1, limit = 20) {
    return this.shipmentModel
      .find({ carrierId, ...filters })
      .skip((page - 1) * limit)
      .limit(limit);
  }

  async findByIdOrFail(id: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    return shipment;
  }

  // Update addMilestone
  async addMilestone(id: string, dto: UpdateMilestoneDto) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.milestones.push({
      eventId: `EVT-${Date.now()}`,
      event: dto.event,
      timestamp: new Date(dto.timestamp),
      location: dto.location || "",
      notes: dto.notes || "",
      // Add other default/optional Milestone fields here if needed (latitude, longitude, reportedBy)
    });
    return shipment.save();
  }

  // Update uploadDocument
  async uploadDocument(id: string, dto: UploadDocumentDto, userId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.documents.push({
      docId: `DOC-${Date.now()}`, // generate new docId
      docType: dto.docType,
      fileUrl: dto.fileUrl,
      fileHash: "", // fill in if you hash files
      uploadedAt: new Date(),
      uploadedBy: userId,
      verified: false,
    });
    return shipment.save();
  }

  async uploadPOD(
    id: string,
    body: { receiverName: string; podPhotos: string[] }
  ) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.pod = {
      status: "UPLOADED",
      deliveryTimestamp: new Date(),
      ...body,
    };
    return shipment.save();
  }

  async markDelivered(id: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    shipment.status = "DELIVERED";
    return shipment.save();
  }

  async getTracking(id: string) {
    const shipment = await this.shipmentModel
      .findById(id)
      .select("milestones pod status delivery");
    if (!shipment) throw new NotFoundException("Shipment not found");
    return shipment;
  }

  async verifyDocument(id: string, docId: string, adminId: string) {
    const shipment = await this.shipmentModel.findById(id);
    if (!shipment) throw new NotFoundException("Shipment not found");
    const doc = shipment.documents.find((d) => d.docId === docId);
    if (!doc) throw new NotFoundException("Document not found");
    doc.verified = true;
    return shipment.save();
  }
}
