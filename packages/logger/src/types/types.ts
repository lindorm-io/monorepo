import { Dict } from "@lindorm/types";
import { LogLevel } from "../types";

export type FilterCallback = (data: any) => string;

export type Log = {
  context?: LogContent;
  extra?: Array<LogContent>;
  level?: LogLevel;
  message: string;
};

export type LogContent = Dict | Error | null | undefined;

export type LogCorrelation = Dict<string | number | boolean>;

export type LogFilters = Dict<FilterCallback | undefined>;

export type LogScope = Array<string>;
