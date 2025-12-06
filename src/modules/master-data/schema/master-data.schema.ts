import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type MasterDataDocument = MasterData & Document;

@Schema()
export class FleetTypeItem {
    @Prop({ required: true })
    type: string;

    @Prop({ required: true })
    label: string;
}
const FleetTypeItemSchema = SchemaFactory.createForClass(FleetTypeItem);

@Schema({ timestamps: true })
export class MasterData {
    @Prop({ type: [FleetTypeItemSchema], default: [] })
    fleetTypes: FleetTypeItem[];
}

export const MasterDataSchema = SchemaFactory.createForClass(MasterData);
