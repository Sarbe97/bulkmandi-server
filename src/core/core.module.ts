import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DocumentHandlerService } from "./file/services/document-handler.service";
import { FileStorageService } from "./file/services/file-storage.service";
import { CustomLoggerService } from "./logger/custom.logger.service";
import { Log, LogSchema } from "./logger/log.schema";

@Global()
@Module({
  imports: [MongooseModule.forFeature([{ name: Log.name, schema: LogSchema }])],
  providers: [CustomLoggerService, DocumentHandlerService, FileStorageService],
  exports: [CustomLoggerService, DocumentHandlerService,FileStorageService],
})
export class CoreModule {}
