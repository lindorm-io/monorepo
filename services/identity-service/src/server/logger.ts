import { Environment } from "@lindorm-io/koa";
import { configuration } from "./configuration";
import { createLogger } from "@lindorm-io/node-server";

export const winston = createLogger({
  environment: configuration.server.environment as Environment,
});
