import { LoggerOptions, LogLevel } from "@lindorm-io/winston";

export interface CreateLoggerOptions extends LoggerOptions {
  level: LogLevel;
  colours: boolean;
  readable: boolean;
  timestamp: boolean;
}
