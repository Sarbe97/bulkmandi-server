import { Controller, Post, Param } from '@nestjs/common';
import { DevService } from './dev.service';

@Controller('dev')
export class DevController {
  constructor(private readonly devService: DevService) {}

  /**
   * Revert order to initial state
   * POST /dev/reset-order/:orderId
   */
  @Post('reset-order/:orderId')
  async resetOrder(@Param('orderId') orderId: string) {
    return this.devService.resetOrder(orderId);
  }

  /**
   * Revert settlement batch to initial state
   * POST /dev/reset-batch/:batchId
   */
  @Post('reset-batch/:batchId')
  async resetBatch(@Param('batchId') batchId: string) {
    return this.devService.resetBatch(batchId);
  }
}
