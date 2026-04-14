import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enquiry, EnquirySchema } from './schemas/enquiry.schema';
import { EnquiriesService } from './enquiries.service';
import { EnquiriesController } from './enquiries.controller';
import { OtpModule } from '../otp/otp.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { MasterDataModule } from '../master-data/master-data.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RfqModule } from '../rfq/rfq.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Enquiry.name, schema: EnquirySchema }]),
    OtpModule,
    OrganizationsModule,
    UsersModule,
    MasterDataModule,
    NotificationsModule,
    RfqModule,
  ],
  controllers: [EnquiriesController],
  providers: [EnquiriesService],
  exports: [EnquiriesService],
})
export class EnquiriesModule {}
