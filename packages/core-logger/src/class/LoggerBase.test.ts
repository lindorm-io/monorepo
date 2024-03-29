import { LogLevel } from "../enum";
import {
  ConsoleOptions,
  FilterCallback,
  Level,
  LogContext,
  Logger,
  LoggerMessage,
  LoggerOptions,
  LogSession,
} from "../types";
import { defaultFilterCallback } from "../util";
import { LoggerBase } from "./LoggerBase";

const addConsole = jest.fn();
const createChildLogger = jest.fn();
const createSessionLogger = jest.fn();
const log = jest.fn();

class TestLogger extends LoggerBase {
  constructor(options: LoggerOptions = {}) {
    super(options);
  }

  public addConsole(level?: Level, options?: Partial<ConsoleOptions>) {
    addConsole(level, options);
  }

  public createChildLogger(context: LogContext): Logger {
    createChildLogger(context);
    return this;
  }

  public createSessionLogger(session: LogSession): Logger {
    createSessionLogger(session);
    return this;
  }

  protected log(options: LoggerMessage) {
    log(options);
  }
}

describe("LoggerBase", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new TestLogger();
  });

  afterEach(jest.resetAllMocks);

  test("should create a logger instance", () => {
    expect(logger.addConsole).toBeInstanceOf(Function);
  });

  test("should add console", () => {
    logger.addConsole(LogLevel.SILLY, { colours: true, readable: true, timestamp: true });

    expect(addConsole).toHaveBeenCalledWith("silly", {
      colours: true,
      readable: true,
      timestamp: true,
    });
  });

  test("should log error string", () => {
    logger.error("message");

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "error",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log error object", () => {
    logger.error(new Error("error message"));

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [new Error("error message")],
      level: "error",
      message: "error message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log warn", () => {
    logger.warn("message");

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "warn",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log info", () => {
    logger.info("message");

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "info",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log verbose", () => {
    logger.verbose("message");

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "verbose",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log debug", () => {
    logger.debug("message");

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "debug",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log silly", () => {
    logger.silly("message");

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [],
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should be able to create a child logger with an array of context", () => {
    expect(() => logger.createChildLogger(["one", "two", "three"])).not.toThrow();
    expect(createChildLogger).toHaveBeenCalledWith(["one", "two", "three"]);
  });

  test("should be able to create a child logger with a context string", () => {
    expect(() => logger.createChildLogger("five")).not.toThrow();
    expect(createChildLogger).toHaveBeenCalledWith("five");
  });

  test("should be able to create a session logger with an object session", () => {
    expect(() => logger.createSessionLogger({ id: "id" })).not.toThrow();
    expect(createSessionLogger).toHaveBeenCalledWith({ id: "id" });
  });

  test("should add default filter", () => {
    logger.setFilter("filtered.path.message");

    expect(logger.filters).toStrictEqual({ "filtered.path.message": defaultFilterCallback });

    logger.silly("message", {
      mock: "details",
      filtered: { path: { message: "message" } },
    });

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [
        {
          filtered: {
            path: {
              message: "[Filtered]",
            },
          },
          mock: "details",
        },
      ],
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should add custom filter", () => {
    const customFilter: FilterCallback = (value) => `custom+${value}`;

    logger.setFilter("filtered.path.message", customFilter);

    expect(logger.filters).toStrictEqual({ "filtered.path.message": customFilter });

    logger.silly("message", {
      mock: "details",
      filtered: { path: { message: "message" } },
    });

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [
        {
          filtered: {
            path: {
              message: "custom+message",
            },
          },
          mock: "details",
        },
      ],
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });
});
