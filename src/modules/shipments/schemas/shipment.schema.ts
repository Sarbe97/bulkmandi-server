import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ShipmentDocument = Shipment & Document;

@Schema({ _id: false })
export class Milestone {
  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true })
  event!: string; // PICKUP | IN_TRANSIT | DELIVERED

  @Prop({ required: true })
  timestamp!: Date;

  @Prop()
  location?: string;

  @Prop()
  latitude?: number;

  @Prop()
  longitude?: number;

  @Prop()
  notes?: string;

  @Prop()
  reportedBy?: string;
}

@Schema({ _id: false })
export class ShipmentDoc {
  @Prop({ required: true })
  docId!: string;

  @Prop({ required: true })
  docType!: string; // LORRY_RECEIPT | WEIGHBRIDGE_SLIP | E_WAY_BILL | QC_CERTIFICATE | POD

  @Prop()
  fileUrl?: string;

  @Prop()
  fileHash?: string;

  @Prop()
  uploadedAt?: Date;

  @Prop()
  uploadedBy?: string;

  @Prop({ default: false })
  verified!: boolean;
}

@Schema({ timestamps: true })
export class Shipment {
  @Prop({ required: true, unique: true })
  shipmentId!: string; // SHP-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Order', required: true })
  orderId!: Types.ObjectId;

  // Parties
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  carrierId!: Types.ObjectId; // 3PL

  // Product
  @Prop({ type: Object, required: true })
  product!: {
    category: string;
    grade: string;
    quantityMT: number;
  };

  // Vehicle
  @Prop({ type: Object })
  vehicle?: {
    vehicleNumber?: string;
    vehicleType?: string;
    driverName?: string;
    driverMobile?: string;
  };

  // Pickup & Delivery
  @Prop({ type: Object, required: true })
  pickup!: {
    location: string;
    pin: string;
    scheduledAt?: Date;
    actualAt?: Date;
  };

  @Prop({ type: Object, required: true })
  delivery!: {
    location: string;
    pin: string;
    city: string;
    state: string;
    scheduledAt?: Date;
    actualAt?: Date;
    eta?: Date;
  };

  // Status
  @Prop({ default: 'PICKUP_PLANNED' })
  status!: string; // PICKUP_PLANNED | PICKUP_CONFIRMED | IN_TRANSIT | DELIVERED | CANCELLED

  @Prop({ type: Array, default: [] })
  statusTimeline!: { status: string; timestamp: Date }[];

  // Milestones
  @Prop({ type: [Milestone], default: [] })
  milestones!: Milestone[];

  // Documents
  @Prop({ type: [ShipmentDoc], default: [] })
  documents!: ShipmentDoc[];

  // POD
  @Prop({ type: Object, default: {} })
  pod!: {
    status?: string;
    deliveryTimestamp?: Date;
    receiverName?: string;
    podPhotos?: string[];
    podUploadedAt?: Date;
  };
}

export const ShipmentSchema = SchemaFactory.createForClass(Shipment);

// ShipmentSchema.index({ shipmentId: 1 });
ShipmentSchema.index({ orderId: 1 });
ShipmentSchema.index({ sellerId: 1, status: 1 });
ShipmentSchema.index({ carrierId: 1, status: 1 });
ShipmentSchema.index({ buyerId: 1, status: 1 });
