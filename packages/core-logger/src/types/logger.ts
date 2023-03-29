import {
  ConsoleOptions,
  FilterCallback,
  FilterRecord,
  Level,
  LogContext,
  LogDetails,
  LogSession,
} from "./types";

export type LoggerMessage = {
  context: Array<string>;
  details: Array<LogDetails>;
  level: Level;
  message: string;
  session: LogSession;
  time: Date;
};

export type LoggerOptions = {
  context?: Array<string>;
  filters?: FilterRecord;
  parent?: Logger;
  session?: LogSession;
};

export interface Logger {
  error(messageOrError: Error | string, details?: LogDetails): void;
  warn(message: string, details?: LogDetails): void;
  info(message: string, details?: LogDetails): void;
  verbose(message: string, details?: LogDetails): void;
  debug(message: string, details?: LogDetails): void;
  silly(message: string, details?: LogDetails): void;

  createChildLogger(context: LogContext): Logger;
  createSessionLogger(session: LogSession): Logger;

  addConsole(level?: Level, options?: Partial<ConsoleOptions>): void;
  addContext(context: LogContext): void;
  addSession(session: Record<string, any>): void;

  setFilter(path: string, callback?: FilterCallback): void;
  deleteFilter(path: string): void;
  clearFilters(): void;

  className: string;
  context: Array<string>;
  filters: FilterRecord;
  session: LogSession;
}
