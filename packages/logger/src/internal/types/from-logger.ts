import { Logger as WinstonLogger } from "winston";
import type {
  FilterCallback,
  LogCorrelation,
  LogFilters,
  LogScope,
} from "../../types/index.js";

export type FilterEntriesRef = {
  entries: Array<[string, FilterCallback | undefined]>;
};

export type KeyFilterRef = {
  exact: Map<string, FilterCallback>;
  patterns: Array<[RegExp, FilterCallback]>;
};

export type FromLogger = {
  _mode: "from_logger";
  correlation: LogCorrelation;
  filterRef: FilterEntriesRef;
  filters: LogFilters;
  keyFilterRef: KeyFilterRef;
  scope: LogScope;
  timers: Map<string, number>;
  winston: WinstonLogger;
};
