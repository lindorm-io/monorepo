import { ConsoleLogger } from "./ConsoleLogger";
import { Logger } from "../types";

const error = jest.spyOn(console, "error").mockImplementation(() => {});
const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
const info = jest.spyOn(console, "info").mockImplementation(() => {});
const debug = jest.spyOn(console, "debug").mockImplementation(() => {});
const log = jest.spyOn(console, "log").mockImplementation(() => {});

describe("ConsoleLogger", () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logger.addConsole("silly");
  });

  afterEach(jest.resetAllMocks);

  test("should create a logger instance", () => {
    expect(logger.addConsole).toBeInstanceOf(Function);
  });

  test("should log error", () => {
    logger.error("message");

    expect(error).toHaveBeenCalledWith({
      context: [],
      details: null,
      level: "error",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log warn", () => {
    logger.warn("message");

    expect(warn).toHaveBeenCalledWith({
      context: [],
      details: null,
      level: "warn",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log info", () => {
    logger.info("message");

    expect(info).toHaveBeenCalledWith({
      context: [],
      details: null,
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
      details: null,
      level: "verbose",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should log debug", () => {
    logger.debug("message");

    expect(debug).toHaveBeenCalledWith({
      context: [],
      details: null,
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
      details: null,
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should be able to create a child logger with an array of context", () => {
    expect(() => logger.createChildLogger(["one", "two", "three"])).not.toThrow();
  });

  test("should be able to create a child logger with a context string", () => {
    expect(() => logger.createChildLogger("five")).not.toThrow();
  });

  test("should use context logger", () => {
    const context = logger.createChildLogger(["oneString", "twoString", "threeString"]);
    context.addContext("fourString");
    context.info("message");

    expect(info).toHaveBeenCalledWith({
      context: ["one_string", "two_string", "three_string", "four_string"],
      details: null,
      level: "info",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });

  test("should be able to create a session logger with an object session", () => {
    expect(() => logger.createSessionLogger({ id: "id" })).not.toThrow();
  });

  test("should use session logger", () => {
    const session = logger.createSessionLogger({ id: 1 });
    session.addSession({ data: "two" });
    session.info("message");

    expect(info).toHaveBeenCalledWith({
      context: [],
      details: null,
      level: "info",
      message: "message",
      session: { id: 1, data: "two" },
      time: expect.any(Date),
    });
  });

  test("should throw error when the context is wrong", () => {
    // @ts-ignore
    expect(() => logger.createChildLogger(true)).toThrow(Error);
  });

  test("should throw error when the session is wrong", () => {
    // @ts-ignore
    expect(() => logger.createSessionLogger(12345)).toThrow(Error);
  });

  test("should add filter", () => {
    logger.setFilter("filtered.path.message");
    logger.silly("message", {
      mock: "details",
      filtered: { path: { message: "message" } },
    });

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: {
        filtered: {
          path: {
            message: "[Filtered]",
          },
        },
        mock: "details",
      },
      level: "silly",
      message: "message",
      session: {},
      time: expect.any(Date),
    });
  });
});
