import type { LogCorrelation, LogFilters, LogLevel, LogScope } from "../types/index.js";

export type LoggerOptions = {
  correlation?: LogCorrelation;
  filters?: LogFilters;
  level?: LogLevel;
  readable?: boolean;
  scope?: LogScope;
};
