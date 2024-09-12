import { FilterCallback, Log, LogContent, LogCorrelation, LogScope } from "../types";

export interface ILogger {
  child(): ILogger;
  child(scope: LogScope): ILogger;
  child(correlation: LogCorrelation): ILogger;
  child(scope: LogScope, correlation: LogCorrelation): ILogger;

  filter(path: string, callback?: FilterCallback): void;

  error(error: Error): void;
  error(message: string, context?: LogContent, extra?: Array<LogContent>): void;

  warn(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  info(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  debug(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  silly(message: string, context?: LogContent, extra?: Array<LogContent>): void;

  log(log: Log): void;
}
