import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { ActivityTransformService } from './services/activity-transform.service';
import { AuditLog, AuditLogSchema } from './schemas/audit-log.schema';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    forwardRef(() => NotificationsModule),
  ],
  controllers: [AuditController],
  providers: [AuditService, ActivityTransformService],
  exports: [AuditService, ActivityTransformService],
})
export class AuditModule {}
