import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { UserRole } from "../../../common/enums";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop()
  mobile: string;

  @Prop()
  name: string; // NEW: Admin name

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole; // SELLER, BUYER, THREE_PL, ADMIN

  // For non-admin users (SELLER, BUYER, LOGISTIC)
  @Prop({ type: Types.ObjectId, ref: "Organization", required: false })
  organizationId: Types.ObjectId; //


  // For ADMIN users only
  @Prop({ type: [String], default: [] })
  permissions: string[]; // ['KYC_APPROVE', 'DISPUTE_RESOLVE', etc.]

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isMobileVerified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;

  @Prop()
  lastLoginIp: string; // NEW: Track login IP

  @Prop({ default: null })
  usedInviteCode?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual for populated organizationId
UserSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "_id",
  justOne: true,
});
