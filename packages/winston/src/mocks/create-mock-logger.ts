import { ILogger } from "../types";

export const createMockLogger = (): ILogger => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),

  createChildLogger: jest.fn().mockImplementation((): ILogger => createMockLogger()),
  createSessionLogger: jest.fn().mockImplementation((): ILogger => createMockLogger()),

  addConsole: jest.fn(),
  addContext: jest.fn(),
  addSession: jest.fn(),

  setFilter: jest.fn(),
  deleteFilter: jest.fn(),
  clearFilters: jest.fn(),

  className: "MockLogger",

  isInfo: jest.fn().mockImplementation(() => true),
  isError: jest.fn().mockImplementation(() => true),
  isWarn: jest.fn().mockImplementation(() => true),
  isDebug: jest.fn().mockImplementation(() => true),
});
