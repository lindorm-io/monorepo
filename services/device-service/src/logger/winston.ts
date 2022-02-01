import { Environment } from "@lindorm-io/koa";
import { Logger, LogLevel } from "@lindorm-io/winston";
import { configuration } from "../configuration";

export const winston = new Logger();

switch (configuration.server.environment) {
  case Environment.DEVELOPMENT:
    winston.addConsole(LogLevel.DEBUG, true);
    break;

  case Environment.TEST:
    winston.addConsole(LogLevel.ERROR, true);
    break;

  default:
    winston.addConsole(LogLevel.INFO);
    break;
}
