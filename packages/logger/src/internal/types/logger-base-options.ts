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

// Shape passed up to LoggerBase by both Logger (root, after building winston)
// and LoggerChild (inheriting refs from a parent). All shared infrastructure
// is provided by the constructing class — LoggerBase doesn't construct any.
export type LoggerBaseOptions = {
  correlation: LogCorrelation;
  filters: LogFilters;
  filterRef: FilterEntriesRef;
  keyFilterRef: KeyFilterRef;
  scope: LogScope;
  timers: Map<string, number>;
  winston: WinstonLogger;
};
