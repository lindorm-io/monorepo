import { LogCorrelation, LogFilters, LogLevel, LogScope } from "../types";

export type LoggerOptions = {
  correlation?: LogCorrelation;
  filters?: LogFilters;
  level?: LogLevel;
  readable?: boolean;
  scope?: LogScope;
};
