import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LogDocument = HydratedDocument<Log>;

@Schema()
export class Log {
  @Prop()
  level: string;

  @Prop()
  message: string;

  @Prop()
  context: string;

  @Prop()
  trace: string;

  @Prop({ type: Object })
  metadata: object;

  @Prop()
  timestamp: string;
}

export const LogSchema = SchemaFactory.createForClass(Log);
