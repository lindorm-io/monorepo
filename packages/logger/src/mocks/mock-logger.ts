import { ILogger } from "../interfaces";

type LogFn = (...args: any) => void;

export const createMockLogger = (logFn?: LogFn): ILogger => {
  const logger = {
    child: jest.fn().mockImplementation((): ILogger => createMockLogger(logFn)),
    filter: jest.fn(),

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
    log: jest.fn().mockImplementation((arg) => (logFn ? logFn(arg) : undefined)),
  };

  return logger;
};
