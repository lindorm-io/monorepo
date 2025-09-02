import { Logger as WinstonLogger } from "winston";
import { LogCorrelation, LogFilters, LogScope } from "../types";

export type FromLogger = {
  _mode: "from_logger";
  correlation: LogCorrelation;
  filters: LogFilters;
  scope: LogScope;
  winston: WinstonLogger;
};
