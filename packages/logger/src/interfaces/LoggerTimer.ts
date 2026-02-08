import { LogContent } from "../types";

export interface ILoggerTimer {
  error(error: Error): void;
  error(message: string, context?: LogContent, extra?: Array<LogContent>): void;

  warn(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  info(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  debug(message: string, context?: LogContent, extra?: Array<LogContent>): void;
  silly(message: string, context?: LogContent, extra?: Array<LogContent>): void;
}
