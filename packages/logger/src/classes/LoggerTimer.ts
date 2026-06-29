import { isError } from "@lindorm/is";
import type { ILoggerTimer } from "../interfaces/LoggerTimer.js";
import type { LogContent, LogLevel } from "../types/index.js";

export type TimerLogFn = (
  level: LogLevel,
  message: string,
  context: LogContent,
  extra: Array<LogContent>,
  duration: number,
) => void;

export class LoggerTimer implements ILoggerTimer {
  private readonly start: number;
  private readonly logFn: TimerLogFn;

  constructor(logFn: TimerLogFn) {
    this.start = performance.now();
    this.logFn = logFn;
  }

  error(error: Error): void;
  error(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  error(arg1: Error | string, context?: LogContent, extra?: Array<LogContent>): void {
    if (isError(arg1)) {
      this.logFn(
        "error",
        arg1.message,
        arg1,
        extra ?? [],
        performance.now() - this.start,
      );
    } else {
      this.logFn(
        "error",
        arg1,
        context ?? {},
        extra ?? [],
        performance.now() - this.start,
      );
    }
  }

  warn(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "warn",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  info(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "info",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "verbose",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  debug(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "debug",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  silly(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "silly",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }
}
