import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { Document, Types } from "mongoose";
import { UserRole } from "../../../common/enums";

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true, unique: true })
  mobile: string;

  @Prop({ type: String, enum: UserRole, required: true })
  role: UserRole;

  @Prop({ type: Types.ObjectId, ref: "Organization", required: true })
  organizationId: Types.ObjectId;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ default: false })
  isMobileVerified: boolean;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLoginAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Add virtual for populated organizationId
UserSchema.virtual("organization", {
  ref: "Organization",
  localField: "organizationId",
  foreignField: "_id",
  justOne: true,
});
