import { Module } from '@nestjs/common';
import { UtilityApisController } from './utility-apis.controller';
import { UtilityApisService } from './utility-apis.service';

@Module({
  providers: [UtilityApisService],
  controllers: [UtilityApisController],
  exports: [UtilityApisService],
})
export class UtilityApisModule {}
