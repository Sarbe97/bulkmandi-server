import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CustomLoggerService } from "./logger/custom.logger.service";
import { Log, LogSchema } from "./logger/log.schema";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  providers: [CustomLoggerService],
  exports: [CustomLoggerService],
})
export class CoreModule {}
