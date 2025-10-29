import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ required: true, unique: true })
  orderId!: string; // ORD-2025-00001

  @Prop({ type: Types.ObjectId, ref: 'Rfq', required: true })
  rfqId!: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Quote', required: true })
  quoteId!: Types.ObjectId;

  // Parties
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  buyerId!: Types.ObjectId;

  @Prop({ required: true })
  buyerOrgName!: string;

  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true })
  sellerId!: Types.ObjectId;

  @Prop({ required: true })
  sellerOrgName!: string;

  // Product details
  @Prop({ type: Object, required: true })
  product!: {
    category: string;
    grade: string;
    quantityMT: number;
    specifications: string;
  };

  // Pricing breakdown
  @Prop({ type: Object, required: true })
  pricing!: {
    pricePerMT: number;
    quantityMT: number;
    baseAmount: number;
    freightPerMT: number;
    freightTotal: number;
    taxRate: number;
    taxAmount: number;
    grandTotal: number;
    currency: string;
  };

  // Delivery
  @Prop({ required: true })
  incoterm!: string;

  @Prop({ required: true })
  deliveryPin!: string;

  @Prop()
  deliveryCity?: string;

  @Prop()
  deliveryState?: string;

  @Prop({ required: true })
  deliveryBy!: Date;

  // Status lifecycle
  @Prop({ default: 'CONFIRMED' })
  status!: string; // CONFIRMED | PAYMENT_PENDING | PAID | DISPATCH_PREP | IN_TRANSIT | DELIVERED | CANCELLED

  @Prop({ type: Object, default: {} })
  lifecycle!: {
    confirmedAt?: Date;
    paymentPendingAt?: Date;
    paidAt?: Date;
    dispatchPrepAt?: Date;
    cancelledAt?: Date;
  };

  // Payment details
  @Prop({ type: Object, default: {} })
  payment!: {
    paymentId?: string;
    paymentMethod?: string;
    utr?: string;
    escrowHolds?: number;
    escrowReleased?: boolean;
    escrowReleasedAt?: Date;
  };

  // Shipment references
  @Prop({ type: [Types.ObjectId], ref: 'Shipment', default: [] })
  shipmentIds!: Types.ObjectId[];

  @Prop({ default: 0 })
  shipmentCount!: number;

  // Dispute references
  @Prop({ type: [Types.ObjectId], ref: 'Dispute', default: [] })
  disputeIds!: Types.ObjectId[];

  @Prop({ default: false })
  hasDispute!: boolean;

  // Documents
  @Prop({ type: Object })
  documents?: {
    proformaInvoiceId?: string;
    proformaInvoiceUrl?: string;
    taxInvoiceId?: string;
    taxInvoiceUrl?: string;
    eWayBillId?: string;
    eWayBillUrl?: string;
  };
}

export const OrderSchema = SchemaFactory.createForClass(Order);

// OrderSchema.index({ orderId: 1 });
OrderSchema.index({ buyerId: 1, createdAt: -1 });
OrderSchema.index({ sellerId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ rfqId: 1 });
