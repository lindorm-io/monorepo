import { Logger, LogLevel } from "@lindorm-io/winston";

export const logger = new Logger();

logger.addConsole(LogLevel.INFO, { readable: true, colours: true, timestamp: false });
