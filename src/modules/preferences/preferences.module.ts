import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BuyerPreference, BuyerPreferenceSchema } from './schemas/buyer-preference.schema';
import { SellerPreference, SellerPreferenceSchema } from './schemas/seller-preference.schema';
import { LogisticPreference, LogisticPreferenceSchema } from './schemas/logistic-preference.schema';
import { PreferencesService } from './preferences.service';
import { PreferencesController } from './preferences.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BuyerPreference.name, schema: BuyerPreferenceSchema },
      { name: SellerPreference.name, schema: SellerPreferenceSchema },
      { name: LogisticPreference.name, schema: LogisticPreferenceSchema },
    ]),
  ],
  controllers: [PreferencesController],
  providers: [PreferencesService],
  exports: [PreferencesService],
})
export class PreferencesModule {}
