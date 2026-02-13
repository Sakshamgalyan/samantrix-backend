import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type VerificationDocument = HydratedDocument<Verification>;

@Schema({ timestamps: true })
export class Verification {
  @Prop({ required: true })
  email: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  otp: string;

  @Prop({ required: true })
  expiresAt: Date;

  @Prop({ default: 0 })
  useCount: number;

  @Prop({ default: false })
  isUsed: boolean;
}

export const VerificationSchema = SchemaFactory.createForClass(Verification);

// Index for automatic deletion of expired documents
VerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
