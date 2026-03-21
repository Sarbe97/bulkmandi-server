import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";

export type LogisticPreferenceDocument = LogisticPreference & Document;

@Schema({ _id: false })
export class FleetTypeItem {
  @Prop() type: string;
  @Prop() label: string;
  @Prop() vehicleCount: number;
}

@Schema({ _id: false })
export class DocumentUpload {
  @Prop() docType?: string;
  @Prop() fileName?: string;
  @Prop() fileUrl?: string;
  @Prop({ type: Date }) uploadedAt?: Date;
  @Prop() status?: string; //['UPLOADED', 'PENDING', 'VERIFIED', 'REJECTED']
}

@Schema({ timestamps: true })
export class LogisticPreference {
  @Prop({ type: Types.ObjectId, ref: 'Organization', required: true, unique: true })
  organizationId: Types.ObjectId;

  @Prop({ type: [FleetTypeItem], default: [] }) 
  fleetTypes: FleetTypeItem[];

  @Prop() 
  insuranceExpiry?: string;

  @Prop({ type: DocumentUpload }) 
  policyDocument?: DocumentUpload;

  @Prop() 
  ewayBillIntegration?: string; // api | manual

  @Prop() 
  podMethod?: string; // driver_app | pdf
}

export const LogisticPreferenceSchema = SchemaFactory.createForClass(LogisticPreference);
