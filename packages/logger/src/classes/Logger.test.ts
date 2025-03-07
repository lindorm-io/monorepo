import MockDate from "mockdate";
import { ILogger } from "../interfaces";
import { Logger } from "./Logger";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const add = jest.fn();
const log = jest.fn();

jest.mock("winston", () => ({
  ...jest.requireActual("winston"),
  createLogger: jest.fn(() => ({
    add,
    log,
  })),
}));

describe("Logger", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = new Logger();
  });

  afterEach(jest.clearAllMocks);

  test("should log error", () => {
    logger.error("hello", new Error("error message"), [{ extra: "1" }, { extra: 2 }]);

    expect(log).toHaveBeenCalledWith({
      context: expect.objectContaining({
        error: expect.any(Error),
        message: "error message",
        name: "Error",
        //stack: expect.any(Array),
      }),
      correlation: {},
      extra: [{ extra: "1" }, { extra: 2 }],
      level: "error",
      message: "hello",
      scope: [],
      time: MockedDate,
    });
  });

  test("should log info", () => {
    logger.info("hello", { info: "data" }, [{ extra: "1" }, { extra: 2 }]);

    expect(log).toHaveBeenCalledWith({
      context: { info: "data" },
      correlation: {},
      extra: [{ extra: "1" }, { extra: 2 }],
      level: "info",
      message: "hello",
      scope: [],
      time: MockedDate,
    });
  });

  test("should create child loggers and log", () => {
    expect(add).toHaveBeenCalledTimes(1);

    const parent = logger.child(["parent"], { parent: "parent" });
    const child = parent.child(["child"], { child: "child" });

    expect(add).toHaveBeenCalledTimes(1);

    expect(child).toBeInstanceOf(Logger);

    child.correlation({ again: "again" });
    child.scope(["again"]);

    // @ts-expect-error
    expect(child._correlation).toEqual({
      parent: "parent",
      child: "child",
      again: "again",
    });

    // @ts-expect-error
    expect(child._scope).toEqual(["parent", "child", "again"]);

    child.verbose("verbose message", { extra: "verbose extra" });

    expect(log).toHaveBeenCalledWith({
      context: { extra: "verbose extra" },
      correlation: { parent: "parent", child: "child", again: "again" },
      extra: [],
      level: "verbose",
      message: "verbose message",
      scope: ["parent", "child", "again"],
      time: MockedDate,
    });
  });

  test("should filter data", () => {
    logger.filter("password");
    logger.filter("path1.path2.secret", () => "******");

    logger.info(
      "message",
      {
        path1: { path2: { secret: "secret" } },
      },
      [{ password: "password" }],
    );

    expect(log).toHaveBeenCalledWith({
      context: {
        path1: {
          path2: {
            secret: "******",
          },
        },
      },
      correlation: {},
      extra: [{ password: "[Filtered]" }],
      level: "info",
      message: "message",
      scope: [],
      time: MockedDate,
    });
  });
});
