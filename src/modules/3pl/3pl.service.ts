import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
    Shipment,
    ShipmentDocument,
} from "../shipments/schemas/shipment.schema";
import { AssignmentDto } from "./dto/assignment.dto";

@Injectable()
export class ThreePLService {
  constructor(
    @InjectModel(Shipment.name) private shipmentModel: Model<ShipmentDocument>
  ) {}

  async assignShipment(dto: AssignmentDto) {
    const shipment = await this.shipmentModel.findById(dto.shipmentId);
    if (!shipment) throw new NotFoundException("Shipment not found");

    shipment.set("carrierId", dto.carrierId);

    return shipment.save();
  }
}
