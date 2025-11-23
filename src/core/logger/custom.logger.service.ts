import { Injectable, LoggerService } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createLogger, format, transports } from "winston";
import DailyRotateFile from "winston-daily-rotate-file";

type LogMetadata = string | object | Error;

@Injectable()
export class CustomLoggerService implements LoggerService {
  private readonly logger;
  private lastLogTime: number = Date.now();
  private readonly logsDir: string;
  private readonly rotationOptions = {
    datePattern: "YYYY-MM-DD",
    zippedArchive: true,
    maxSize: "20m",
    maxFiles: "14d",
  };

  constructor(
    private readonly config: ConfigService,
    // @InjectModel(Log.name) private readonly logModel: Model<Log>,
  ) {
    this.logsDir = this.config.get<string>("logsDir", "logs");
    this.logger = this.createLoggerInstance();
  }

  private createLoggerInstance() {
    const logLevel = this.config.get<string>("LOG_LEVEL", "info");
    const silent = this.config.get<boolean>("LOG_SILENT", false);

    return createLogger({
      level: logLevel, //'debug',
      silent,
      format: format.combine(
        format.timestamp({ format: "YYYY-MM-DD HH:mm:ss.SSS" }),
        format.printf(({ level, timestamp, message, context, metadata, interval }) => {
          const metaString = metadata
            ? ` | meta: ${metadata instanceof Error ? metadata.stack || metadata.message : typeof metadata === "object" ? JSON.stringify(metadata) : metadata}`
            : "";
          const processId = process.pid;
          return `[Store-node] ${processId} - ${timestamp} :: ${level.toUpperCase()} [${context || "General"}] ${message}${metaString} ${interval ? `+${interval}ms` : ""}`;
        }),
      ),
      transports: [
        new transports.Console({
          format: format.colorize({ message: false }),
        }),
        new DailyRotateFile({
          filename: `${this.logsDir}/application-%DATE%.json`,
          ...this.rotationOptions,
          format: format.combine(format.timestamp(), format.json()),
        }),
        new DailyRotateFile({
          filename: `${this.logsDir}/error-%DATE%.json`,
          ...this.rotationOptions,
          level: "error",
          format: format.combine(format.timestamp(), format.json()),
        }),
        new DailyRotateFile({
          filename: `${this.logsDir}/application-simple-%DATE%.log`,
          ...this.rotationOptions,
          level: "info",
          format: format.combine(
            format.timestamp(),
            format.printf(({ level, timestamp, message, context, metadata, interval }) => {
              const metaString = metadata
                ? ` | meta: ${metadata instanceof Error ? metadata.stack || metadata.message : typeof metadata === "object" ? JSON.stringify(metadata) : metadata}`
                : "";
              const processId = process.pid;
              return `[Store-node] ${processId} - ${timestamp} :: ${level.toUpperCase()} [${context || "General"}] ${message}${metaString} ${interval ? `+${interval}ms` : ""}`;
            }),
          ),
        }),
        // Uncomment if MongoDB logging is needed
        // new transports.Stream({
        //   stream: this.getMongoStream(),
        //   format: format.combine(format.timestamp(), format.json()),
        // }),
      ],
    });
  }

  // private getMongoStream(): Writable {
  //   return new Writable({
  //     write: async (log: string, _: string, callback: Function) => {
  //       try {
  //         const logObj = JSON.parse(log);
  //         const logEntry = new this.logModel({
  //           level: logObj.level,
  //           message: logObj.message,
  //           context: logObj.context,
  //           metadata: logObj.metadata instanceof Error ? logObj.metadata.message : logObj.metadata,
  //           timestamp: new Date(logObj.timestamp),
  //         });
  //         await logEntry.save();
  //         callback();
  //       } catch (error) {
  //         console.error("Error saving log to MongoDB", error);
  //         callback(error);
  //       }
  //     },
  //   });
  // }

  private logMessage(level: string, message: string, metadata?: LogMetadata) {
    const context = this.getCallingFunctionName();
    const now = Date.now();
    const interval = now - this.lastLogTime;

    this.logger.log(level, message, { context, metadata, interval });

    this.lastLogTime = now;
  }

  log(message: string, metadata?: LogMetadata) {
    this.logMessage("info", message, metadata);
  }

  info(message: string, metadata?: LogMetadata) {
    this.logMessage("info", message, metadata);
  }

  error(message: string, metadata?: LogMetadata) {
    this.logMessage("error", message, metadata);
  }

  warn(message: string, metadata?: LogMetadata) {
    this.logMessage("warn", message, metadata);
  }

  debug(message: string, metadata?: LogMetadata) {
    this.logMessage("debug", message, metadata);
  }

  verbose(message: string, metadata?: LogMetadata) {
    this.logMessage("verbose", message, metadata);
  }

  private getCallingFunctionName(depth: number = 3): string {
    try {
      throw new Error();
    } catch (e) {
      const stack = e.stack;
      if (stack) {
        const lines = stack.split("\n");
        if (lines.length >= depth + 2) {
          const line = lines[depth + 1];
          const match = /\s+at\s+(.*?)(\s|\()/.exec(line);
          if (match && match[1]) {
            return match[1];
          }
        }
      }
    }
    return "Unspecified";
  }

  setLogLevel(level: string) {
    this.logger.level = level;
  }

  setSilent(silent: boolean) {
    this.logger.silent = silent;
  }
}
