import { WinstonOptions } from "@lindorm-io/winston";
import { configuration } from "./configuration";
import { createLogger } from "@lindorm-io/node-server";

export const logger = createLogger(configuration.logger as WinstonOptions);
