import { CreateLoggerOptions } from "../types";
import { LogLevel } from "@lindorm-io/core-logger";
import { WinstonLogger } from "@lindorm-io/winston";

export const createLogger = (options: Partial<CreateLoggerOptions> = {}): WinstonLogger => {
  const {
    level = LogLevel.VERBOSE,
    colours = false,
    readable = false,
    timestamp = true,
    ...rest
  } = options;

  if (!Object.values(LogLevel).includes(level)) {
    throw new Error(`Invalid LogLevel [ ${level} ]`);
  }

  const logger = new WinstonLogger(rest);

  logger.addConsole(level, { readable, colours, timestamp });

  return logger;
};
