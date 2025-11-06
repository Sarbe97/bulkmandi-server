interface LogMetadata {
    [key: string]: any;
  }
  
  interface LogOptions {
    context?: string;
    trace?: string;
    metadata?: LogMetadata;
  }