import MockDate from "mockdate";
import { ILogger } from "../types";
import { LindormLogger } from "./LindormLogger";

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

describe("LindormLogger", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = new LindormLogger();
  });

  afterEach(jest.clearAllMocks);

  test("should log error", () => {
    logger.error("hello", new Error("error message"));

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [
        expect.objectContaining({
          error: expect.any(Error),
          message: "error message",
          name: "Error",
          //stack: expect.any(Array),
        }),
      ],
      level: "error",
      message: "hello",
      session: {},
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });

  test("should log info", () => {
    logger.info("hello", { info: "data" });

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [{ info: "data" }],
      level: "info",
      message: "hello",
      session: {},
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });

  test("should create child loggers and log", () => {
    expect(add).toHaveBeenCalledTimes(1);

    const parent = logger.child(["parent"], { parent: "parent" });
    const child = parent.child(["child"], { child: "child" });

    expect(add).toHaveBeenCalledTimes(1);

    expect(child).toBeInstanceOf(LindormLogger);

    // @ts-expect-error
    expect(child._context).toEqual(["parent", "child"]);

    // @ts-expect-error
    expect(child._session).toEqual({ parent: "parent", child: "child" });

    child.verbose("verbose message", { details: "verbose details" });

    expect(log).toHaveBeenCalledWith({
      context: ["parent", "child"],
      details: [{ details: "verbose details" }],
      level: "verbose",
      message: "verbose message",
      session: { parent: "parent", child: "child" },
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });

  test("should filter data", () => {
    logger.filter("password");
    logger.filter("path1.path2.secret", () => "******");

    logger.info("message", {
      path1: { path2: { secret: "secret" } },
      password: "password",
    });

    expect(log).toHaveBeenCalledWith({
      context: [],
      details: [
        {
          password: "[Filtered]",
          path1: {
            path2: {
              secret: "******",
            },
          },
        },
      ],
      level: "info",
      message: "message",
      session: {},
      time: new Date("2024-01-01T10:00:00.000Z"),
    });
  });
});
