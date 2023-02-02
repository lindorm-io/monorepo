import { WinstonLogger, LogLevel } from "@lindorm-io/winston";

export const logger = new WinstonLogger();

logger.addConsole(LogLevel.INFO, { readable: true, colours: true, timestamp: false });
