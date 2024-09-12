import { Dict } from "@lindorm/types";
import { LogLevel } from "../enums";

export type Log = {
  context?: LogContent;
  extra?: Array<LogContent>;
  level?: LogLevel;
  message: string;
};

export type LogContent = Dict | Error | null | undefined;

export type LogCorrelation = Dict<string | number | boolean>;

export type LogScope = Array<string>;

export type FilterCallback = (data: any) => string;

export type FilterRecord = Dict<FilterCallback | undefined>;
