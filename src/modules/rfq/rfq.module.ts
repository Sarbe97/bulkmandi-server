import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { UsersModule } from '../users/users.module';
import { RfqController } from './rfq.controller';
import { RfqService } from './rfq.service';
import { Rfq, RfqSchema } from './schemas/rfq.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Rfq.name, schema: RfqSchema },
    ]),
    OrganizationsModule,
    UsersModule,
    AuthModule,
    AuditModule,
  ],


  controllers: [RfqController],
  providers: [RfqService],
  exports: [RfqService],
})
export class RfqModule { }
