import { CreateLoggerOptions } from "../types";
import { Environment } from "@lindorm-io/koa";
import { Logger, LogLevel } from "@lindorm-io/winston";

export const createLogger = (options: CreateLoggerOptions): Logger => {
  const logger = new Logger();

  switch (options.environment) {
    case Environment.DEVELOPMENT:
      logger.addConsole(LogLevel.DEBUG, { readable: true, colours: true, timestamp: true });
      break;

    case Environment.TEST:
      logger.addConsole(LogLevel.ERROR, { readable: true });
      break;

    default:
      logger.addConsole(LogLevel.INFO);
      break;
  }

  return logger;
};
