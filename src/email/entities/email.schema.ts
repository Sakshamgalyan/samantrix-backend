import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EmailDocument = Email & Document;

@Schema({ timestamps: { createdAt: 'sentAt', updatedAt: false } })
export class Email {
  @Prop({ required: true })
  to: string;

  @Prop({ required: true })
  subject: string;

  @Prop({ required: true })
  message: string;

  @Prop({ type: [String], default: [] })
  attachments: string[]; // Paths to files

  @Prop({ default: 'sent' })
  status: string;

  @Prop({ required: true })
  senderId: string;
}

export const EmailSchema = SchemaFactory.createForClass(Email);
