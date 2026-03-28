import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type OtpDocument = Otp & Document;

@Schema({ timestamps: true })
export class Otp {
  @Prop({ required: true, index: true })
  identifier: string; // email or phone

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true, type: Date })
  expiresAt: Date;

  @Prop({ required: true, enum: ['EMAIL', 'PHONE'] })
  type: string;

  @Prop({ default: false })
  isUsed: boolean;
}

export const OtpSchema = SchemaFactory.createForClass(Otp);

// TTL index to automatically delete expired OTPs after 10 minutes from expiry
OtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });
