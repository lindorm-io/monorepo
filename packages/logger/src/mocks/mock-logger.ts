import { ILogger } from "../interfaces";
import { ILoggerTimer } from "../interfaces/LoggerTimer";

type LogFn = (...args: any) => void;

const createMockTimer = (): ILoggerTimer => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  verbose: jest.fn(),
  debug: jest.fn(),
  silly: jest.fn(),
});

export const createMockLogger = (logFn?: LogFn): ILogger => ({
  __instanceof: "Logger",

  level: "info",

  child: jest.fn().mockImplementation((): ILogger => createMockLogger(logFn)),

  correlation: jest.fn(),
  filterPath: jest.fn(),
  filterKey: jest.fn(),
  isLevelEnabled: jest.fn().mockReturnValue(true),
  scope: jest.fn(),
  time: jest.fn().mockImplementation((): ILoggerTimer => createMockTimer()),
  timeEnd: jest.fn(),

  error: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  warn: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  info: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  verbose: jest
    .fn()
    .mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  debug: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  silly: jest.fn().mockImplementation((...args) => (logFn ? logFn(...args) : undefined)),
  log: jest.fn().mockImplementation((arg) => (logFn ? logFn(arg) : undefined)),
});
