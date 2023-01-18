import { LoggerOptions } from "@lindorm-io/core-logger";
import { ConsoleLogger } from "../class";

export type ConsoleLoggerOptions = Omit<LoggerOptions, "parent"> & {
  parent?: ConsoleLogger;
};
