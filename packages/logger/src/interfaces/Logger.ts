import type {
  FilterCallback,
  Log,
  LogContent,
  LogCorrelation,
  LogLevel,
  LogScope,
} from "../types/index.js";
import type { ILoggerTimer } from "./LoggerTimer.js";

// Surface available to every logger handle, including children.
// Configuration of the underlying winston instance and the shared filter
// registry is intentionally absent — see ILoggerRoot.
export interface ILogger {
  __instanceof: "Logger";

  readonly level: LogLevel;

  child(): ILogger;
  child(scope: LogScope): ILogger;
  child(correlation: LogCorrelation): ILogger;
  child(scope: LogScope, correlation: LogCorrelation): ILogger;

  correlation(correlation: LogCorrelation): void;
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

// Surface available on the root logger only. Adds the mutators that
// touch shared infrastructure: the winston level (affects every transport
// and every child) and the filter registry (shared by reference with
// every child). Children expose ILogger; only the root holds ILoggerRoot.
export interface ILoggerRoot extends Omit<ILogger, "level"> {
  level: LogLevel;

  filterPath(path: string, callback?: FilterCallback): void;
  filterKey(key: string, callback?: FilterCallback): void;
  filterKey(pattern: RegExp, callback?: FilterCallback): void;
}
