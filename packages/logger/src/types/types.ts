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

export type StdLogger = {
  log: (msg: string) => void;
  info: (msg: string) => void;
  success: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
};
