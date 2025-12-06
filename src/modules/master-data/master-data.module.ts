import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MasterData, MasterDataSchema } from './schema/master-data.schema';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: MasterData.name, schema: MasterDataSchema }]),
  ],
  controllers: [MasterDataController],
  providers: [MasterDataService],
})
export class MasterDataModule { }
