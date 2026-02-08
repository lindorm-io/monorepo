import {
  FilterCallback,
  Log,
  LogContent,
  LogCorrelation,
  LogLevel,
  LogScope,
} from "../types";
import { ILoggerTimer } from "./LoggerTimer";

export interface ILogger {
  __instanceof: "Logger";

  level: LogLevel;

  child(): ILogger;
  child(scope: LogScope): ILogger;
  child(correlation: LogCorrelation): ILogger;
  child(scope: LogScope, correlation: LogCorrelation): ILogger;

  correlation(correlation: LogCorrelation): void;
  filterPath(path: string, callback?: FilterCallback): void;
  filterKey(key: string, callback?: FilterCallback): void;
  filterKey(pattern: RegExp, callback?: FilterCallback): void;
  isLevelEnabled(level: LogLevel): boolean;
  scope(scope: LogScope): void;

  time(): ILoggerTimer;
  time(label: string): void;
  timeEnd(label: string, context?: LogContent, extra?: Array<LogContent>): void;
  timeEnd(
    label: string,
    level: LogLevel,
    context?: LogContent,
    extra?: Array<LogContent>,
  ): void;

  error(error: Error): void;
  error(message: string, context?: LogContent, extra?: Array<LogContent>): void;

  warn(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  info(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  debug(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  silly(message: string, context?: LogContent, extra?: Array<LogContent>): void;

  log(log: Log): void;
}
