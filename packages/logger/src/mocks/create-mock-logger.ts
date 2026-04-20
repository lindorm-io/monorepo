import type { Function } from "@lindorm/types";
import { ILogger } from "../interfaces";
import { ILoggerTimer } from "../interfaces/LoggerTimer";

const createMockTimer = (mockFn: () => any): ILoggerTimer => ({
  error: mockFn(),
  warn: mockFn(),
  info: mockFn(),
  verbose: mockFn(),
  debug: mockFn(),
  silly: mockFn(),
});

export const _createMockLogger = (mockFn: () => any, logFn?: Function): ILogger => {
  const impl = (fn: any) => {
    const m = mockFn();
    m.mockImplementation(fn);
    return m;
  };
  const returns = (value: any) => {
    const m = mockFn();
    m.mockReturnValue(value);
    return m;
  };

  return {
    __instanceof: "Logger",
    level: "info",

    child: impl((): ILogger => _createMockLogger(mockFn, logFn)),

    correlation: mockFn(),
    filterPath: mockFn(),
    filterKey: mockFn(),
    isLevelEnabled: returns(true),
    scope: mockFn(),
    time: impl((): ILoggerTimer => createMockTimer(mockFn)),
    timeEnd: mockFn(),

    error: impl((...args: any[]) => logFn?.(...args)),
    warn: impl((...args: any[]) => logFn?.(...args)),
    info: impl((...args: any[]) => logFn?.(...args)),
    verbose: impl((...args: any[]) => logFn?.(...args)),
    debug: impl((...args: any[]) => logFn?.(...args)),
    silly: impl((...args: any[]) => logFn?.(...args)),
    log: impl((arg: any) => logFn?.(arg)),
  } as unknown as ILogger;
};
