import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { UserRole } from "../../../common/enums";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  _id: Types.ObjectId;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ unique: true, sparse: true })
  mobile: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  // @Prop()
  // name: string; // Deprecated, use virtual getter

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole; // SELLER, BUYER, THREE_PL, ADMIN

  // For non-admin users (SELLER, BUYER, LOGISTIC)
  // unique: true + sparse: true → enforces 1 user per org; allows multiple nulls (pre-onboarding)
  @Prop({ type: Types.ObjectId, ref: "Organization", required: false, unique: true, sparse: true })
  organizationId: Types.ObjectId;


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

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual for populated organizationId
// Add virtual for populated organizationId
UserSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "_id",
  justOne: true,
});

// ✅ Virtual getter for full name
UserSchema.virtual("name").get(function () {
  return `${this.firstName || ""} ${this.lastName || ""}`.trim();
});

UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });
