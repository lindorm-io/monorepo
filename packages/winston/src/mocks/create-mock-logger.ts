import { FilterCallback, LogDetails, LoggerTransportOptions, SessionMetadata } from "../types";
import { ILogger } from "../types";
import { LogLevel } from "../enum";

export const createMockLogger = (): ILogger => ({
  error: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),
  warn: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),
  info: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),
  verbose: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),
  debug: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),
  silly: jest.fn().mockImplementation((message: string, details?: LogDetails): void => undefined),

  createChildLogger: jest
    .fn()
    .mockImplementation((context: Array<string>): ILogger => createMockLogger()),
  createSessionLogger: jest
    .fn()
    .mockImplementation((session: SessionMetadata): ILogger => createMockLogger()),

  addConsole: jest
    .fn()
    .mockImplementation(
      (level: LogLevel, options: Partial<LoggerTransportOptions>): void => undefined,
    ),
  addContext: jest.fn().mockImplementation((context: Array<string>): void => undefined),
  addSession: jest.fn().mockImplementation((session: Record<string, any>): void => undefined),

  setFilter: jest
    .fn()
    .mockImplementation((path: string, callback?: FilterCallback): void => undefined),
  deleteFilter: jest.fn().mockImplementation((path: string): void => undefined),
  clearFilters: jest.fn().mockImplementation((): void => undefined),
});
