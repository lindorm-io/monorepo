import { LoggerOptions } from "@lindorm-io/core-logger";
import { WinstonLogger } from "../class";

export type WinstonOptions = Omit<LoggerOptions, "parent"> & {
  parent?: WinstonLogger;
};
