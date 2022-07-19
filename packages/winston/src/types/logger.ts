import { FilterCallback, LogDetails, LoggerTransportOptions, SessionMetadata } from "./index";
import { LogLevel } from "../enum";

export interface ILogger {
  error(message: string, details?: LogDetails): void;
  warn(message: string, details?: LogDetails): void;
  info(message: string, details?: LogDetails): void;
  verbose(message: string, details?: LogDetails): void;
  debug(message: string, details?: LogDetails): void;
  silly(message: string, details?: LogDetails): void;

  createChildLogger(context: Array<string>): ILogger;
  createSessionLogger(session: SessionMetadata): ILogger;

  addConsole(level: LogLevel, options: Partial<LoggerTransportOptions>): void;
  addContext(context: Array<string>): void;
  addSession(session: Record<string, any>): void;

  setFilter(path: string, callback?: FilterCallback): void;
  deleteFilter(path: string): void;
  clearFilters(): void;

  className: string;

  isInfo(): boolean;
  isError(): boolean;
  isWarn(): boolean;
  isDebug(): boolean;
}
