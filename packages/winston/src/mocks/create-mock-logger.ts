import { Logger } from "../class";
import { ILogger } from "../types";

export const createMockLogger = (logFn?: (...args: any) => void): Logger => {
  const logger: ILogger = {
    error: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),
    warn: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),
    info: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),
    verbose: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),
    debug: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),
    silly: jest.fn().mockImplementation((...args) => {
      if (logFn) logFn(...args);
    }),

    createChildLogger: jest.fn().mockImplementation((): Logger => createMockLogger(logFn)),
    createSessionLogger: jest.fn().mockImplementation((): Logger => createMockLogger(logFn)),

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
  };

  return logger as Logger;
};
