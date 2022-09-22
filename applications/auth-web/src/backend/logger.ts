import { Logger, LogLevel } from "@lindorm-io/winston";

export const logger = new Logger();
logger.addConsole(LogLevel.DEBUG, { colours: true, readable: true, timestamp: true });
