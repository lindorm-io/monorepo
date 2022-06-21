import { LoggerOptions } from "@lindorm-io/winston";
import { configuration } from "./configuration";
import { createLogger } from "@lindorm-io/node-server";

export const winston = createLogger(configuration.logger as LoggerOptions);
