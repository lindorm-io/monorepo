import { isError } from "@lindorm/is";
import { ILoggerTimer } from "../interfaces/LoggerTimer";
import { LogContent, LogLevel } from "../types";

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

  public constructor(logFn: TimerLogFn) {
    this.start = performance.now();
    this.logFn = logFn;
  }

  public error(error: Error): void;
  public error(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  public error(
    arg1: Error | string,
    context?: LogContent,
    extra?: Array<LogContent>,
  ): void {
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

  public warn(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "warn",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  public info(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "info",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  public verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "verbose",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  public debug(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "debug",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }

  public silly(message: string, context?: LogContent, extra?: Array<LogContent>): void {
    this.logFn(
      "silly",
      message,
      context ?? {},
      extra ?? [],
      performance.now() - this.start,
    );
  }
}
