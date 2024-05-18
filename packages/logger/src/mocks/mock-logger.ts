import { ILogger } from "../types";

type LogFn = (...args: any) => void;

export const createMockLogger = (logFn?: LogFn): ILogger => {
  const logger = {
    child: jest.fn().mockImplementation((): ILogger => createMockLogger(logFn)),
    context: jest.fn(),
    filter: jest.fn(),
    session: jest.fn(),

    error: jest
      .fn()
      .mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
    warn: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
    info: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
    verbose: jest
      .fn()
      .mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
    debug: jest
      .fn()
      .mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
    silly: jest
      .fn()
      .mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  };

  return logger;
};
