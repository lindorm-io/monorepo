import { CreateLoggerOptions } from "../types";
import { Logger, LogLevel } from "@lindorm-io/winston";

export const createLogger = (options: Partial<CreateLoggerOptions> = {}): Logger => {
  const { level = LogLevel.VERBOSE, colours = false, readable = false, timestamp = true } = options;

  if (!Object.values(LogLevel).includes(level)) {
    throw new Error(`Invalid LogLevel [ ${level} ]`);
  }

  const logger = new Logger();

  logger.addConsole(level, { readable, colours, timestamp });

  return logger;
};
