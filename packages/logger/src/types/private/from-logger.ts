import { Logger as WinstonLogger } from "winston";
import { FilterRecord, LogCorrelation, LogScope } from "../types";

export type FromLogger = {
  _mode: "from_logger";
  correlation: LogCorrelation;
  filters: FilterRecord;
  scope: LogScope;
  winston: WinstonLogger;
};
