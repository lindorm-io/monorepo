import { ILogger } from "../types";
import { FilterCallback, LogDetails, LoggerTransportOptions, SessionMetadata } from "../types";
import { LogLevel } from "../enum";

export const createMockLogger = (): ILogger => ({
  error: (message: string, details?: LogDetails): void => undefined,
  warn: (message: string, details?: LogDetails): void => undefined,
  info: (message: string, details?: LogDetails): void => undefined,
  verbose: (message: string, details?: LogDetails): void => undefined,
  debug: (message: string, details?: LogDetails): void => undefined,
  silly: (message: string, details?: LogDetails): void => undefined,

  createChildLogger: (context: Array<string>): ILogger => createMockLogger(),
  createSessionLogger: (session: SessionMetadata): ILogger => createMockLogger(),

  addConsole: (level: LogLevel, options: Partial<LoggerTransportOptions>): void => undefined,
  addContext: (context: Array<string>): void => undefined,
  addSession: (session: Record<string, any>): void => undefined,

  setFilter: (path: string, callback?: FilterCallback): void => undefined,
  deleteFilter: (path: string): void => undefined,
  clearFilters: (): void => undefined,
});
