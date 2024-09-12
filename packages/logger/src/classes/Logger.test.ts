import MockDate from "mockdate";
import { ILogger } from "../interfaces";
import { Logger } from "./Logger";

MockDate.set("2024-01-01T10:00:00.000Z");

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
      time: new Date("2024-01-01T10:00:00.000Z"),
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
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });

  test("should create child loggers and log", () => {
    expect(add).toHaveBeenCalledTimes(1);

    const parent = logger.child(["parent"], { parent: "parent" });
    const child = parent.child(["child"], { child: "child" });

    expect(add).toHaveBeenCalledTimes(1);

    expect(child).toBeInstanceOf(Logger);

    // @ts-expect-error
    expect(child.correlation).toEqual({ parent: "parent", child: "child" });

    // @ts-expect-error
    expect(child.scope).toEqual(["parent", "child"]);

    child.verbose("verbose message", { extra: "verbose extra" });

    expect(log).toHaveBeenCalledWith({
      context: { extra: "verbose extra" },
      correlation: { parent: "parent", child: "child" },
      extra: [],
      level: "verbose",
      message: "verbose message",
      scope: ["parent", "child"],
      time: new Date("2024-01-01T10:00:00.000Z"),
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
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });
});
