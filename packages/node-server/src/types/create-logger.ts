import { LoggerOptions } from "@lindorm-io/winston";
import { Environment } from "@lindorm-io/koa";

export interface CreateLoggerOptions extends LoggerOptions {
  environment: Environment;
}
