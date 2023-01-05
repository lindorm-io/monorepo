import { LogLevel } from "@lindorm-io/core-logger";
import { WinstonOptions } from "@lindorm-io/winston";

export type CreateLoggerOptions = WinstonOptions & {
  level: LogLevel;
  colours: boolean;
  readable: boolean;
  timestamp: boolean;
};
