import MockDate from "mockdate";
import { ILogger } from "../interfaces";
import { Logger } from "./Logger";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const add = jest.fn();
const log = jest.fn();
const isLevelEnabled = jest.fn().mockReturnValue(true);
const mockTransports: Array<{ level?: string }> = [];

jest.mock("winston", () => ({
  ...jest.requireActual("winston"),
  createLogger: jest.fn(() => ({
    add,
    isLevelEnabled,
    log,
    level: "info",
    transports: mockTransports,
  })),
}));

describe("Logger", () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = new Logger();
  });

  afterEach(jest.clearAllMocks);

  test("should be an instance of ILogger", () => {
    expect(logger).toBeInstanceOf(Logger);
    expect(logger.__instanceof).toBe("Logger");
  });

  // logging methods

  test("should log error with message and Error context", () => {
    logger.error("hello", new Error("error message"), [{ extra: "1" }, { extra: 2 }]);

    expect(log).toHaveBeenCalledWith({
      context: expect.objectContaining({
        error: expect.any(Error),
        message: "error message",
        name: "Error",
      }),
      correlation: {},
      extra: [{ extra: "1" }, { extra: 2 }],
      level: "error",
      message: "hello",
      scope: [],
      time: MockedDate,
    });
  });

  test("should log error with Error directly", () => {
    const err = new Error("direct error");
    logger.error(err);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          error: err,
          name: "Error",
          message: "direct error",
          stack: expect.any(Array),
        }),
        level: "error",
        message: "direct error",
      }),
    );
  });

  test("should log error with string message and no context", () => {
    logger.error("plain error");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        level: "error",
        message: "plain error",
      }),
    );
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

  test("should log warn", () => {
    logger.warn("warning message", { detail: true });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { detail: true },
        level: "warn",
        message: "warning message",
      }),
    );
  });

  test("should log verbose", () => {
    logger.verbose("verbose message");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        level: "verbose",
        message: "verbose message",
      }),
    );
  });

  test("should log debug", () => {
    logger.debug("debug message", { debug: "info" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { debug: "info" },
        level: "debug",
        message: "debug message",
      }),
    );
  });

  test("should log silly", () => {
    logger.silly("silly message");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        level: "silly",
        message: "silly message",
      }),
    );
  });

  test("should log with log() method", () => {
    logger.log({
      context: { data: "context" },
      extra: [{ extra: "extra" }],
      level: "debug",
      message: "log method message",
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { data: "context" },
        extra: [{ extra: "extra" }],
        level: "debug",
        message: "log method message",
      }),
    );
  });

  test("should default to info level when log() called without level", () => {
    logger.log({ message: "no level" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "info",
        message: "no level",
      }),
    );
  });

  test("should log with no context or extra", () => {
    logger.info("bare message");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        extra: [],
        message: "bare message",
      }),
    );
  });

  // child loggers

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

  test("should create child with no arguments", () => {
    const child = logger.child();

    expect(child).toBeInstanceOf(Logger);
    // @ts-expect-error
    expect(child._scope).toEqual([]);
    // @ts-expect-error
    expect(child._correlation).toEqual({});
  });

  test("should create child with only correlation", () => {
    const child = logger.child({ requestId: "abc-123" });

    // @ts-expect-error
    expect(child._correlation).toEqual({ requestId: "abc-123" });
  });

  // filtering

  test("should filter data", () => {
    logger.filterPath("password");
    logger.filterPath("path1.path2.secret", () => "******");

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

  test("should not filter content when no filter paths match", () => {
    logger.filterPath("password");

    logger.info("message", { unrelated: "data" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { unrelated: "data" },
      }),
    );
  });

  test("should not filter when no filters are set", () => {
    logger.info("message", { password: "visible" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "visible" },
      }),
    );
  });

  test("should not clone extracted error data (error + stack pattern)", () => {
    logger.filterPath("message");

    const error = new Error("test");
    logger.error(error);

    // extractErrorData wraps it with { error, name, message, stack }
    // getFilteredContent should skip this because it matches the error+stack pattern
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          error: expect.any(Error),
          stack: expect.any(Array),
        }),
      }),
    );
  });

  test("should handle non-object content gracefully", () => {
    logger.filterPath("key");

    logger.info("message", null);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
      }),
    );
  });

  test("should share filters between parent and child", () => {
    const child = logger.child(["child"]);

    logger.filterPath("password");

    child.info("message", { password: "secret" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "[Filtered]" },
      }),
    );
  });

  test("should share filters from child to parent", () => {
    const child = logger.child(["child"]);

    child.filterPath("token");

    logger.info("message", { token: "abc123" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { token: "[Filtered]" },
      }),
    );
  });

  // filterKey

  test("should filterKey at top level", () => {
    logger.filterKey("password");

    logger.info("message", { password: "secret", user: "alice" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "[Filtered]", user: "alice" },
      }),
    );
  });

  test("should filterKey at nested depth", () => {
    logger.filterKey("password");

    logger.info("message", { user: { credentials: { password: "secret" } } });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { user: { credentials: { password: "[Filtered]" } } },
      }),
    );
  });

  test("should filterKey inside arrays", () => {
    logger.filterKey("password");

    logger.info("message", { users: [{ password: "one" }, { password: "two" }] });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { users: [{ password: "[Filtered]" }, { password: "[Filtered]" }] },
      }),
    );
  });

  test("should filterKey with custom callback", () => {
    logger.filterKey("token", (v) => `${String(v).slice(0, 4)}...`);

    logger.info("message", { token: "abcdefgh" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { token: "abcd..." },
      }),
    );
  });

  test("should share filterKey between parent and child", () => {
    const child = logger.child(["child"]);

    logger.filterKey("password");

    child.info("message", { password: "secret" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "[Filtered]" },
      }),
    );
  });

  test("should share filterKey from child to parent", () => {
    const child = logger.child(["child"]);

    child.filterKey("password");

    logger.info("message", { password: "secret" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "[Filtered]" },
      }),
    );
  });

  test("should coexist filterPath and filterKey on same log", () => {
    logger.filterPath("headers.authorization");
    logger.filterKey("password");

    logger.info("message", {
      headers: { authorization: "Bearer token" },
      user: { password: "secret" },
    });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {
          headers: { authorization: "[Filtered]" },
          user: { password: "[Filtered]" },
        },
      }),
    );
  });

  test("should skip falsy values in filterKey", () => {
    logger.filterKey("empty");

    logger.info("message", { empty: "", present: "yes" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { empty: "", present: "yes" },
      }),
    );
  });

  test("should filterKey multiple keys in same object", () => {
    logger.filterKey("password");
    logger.filterKey("secret");

    logger.info("message", { password: "pw", secret: "sc", visible: "ok" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { password: "[Filtered]", secret: "[Filtered]", visible: "ok" },
      }),
    );
  });

  test("should filterKey with regex matching partial key names", () => {
    logger.filterKey(/token/i);

    logger.info("message", { accessToken: "abc", refreshToken: "xyz", name: "alice" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { accessToken: "[Filtered]", refreshToken: "[Filtered]", name: "alice" },
      }),
    );
  });

  test("should filterKey regex with custom callback", () => {
    logger.filterKey(/token/i, () => "<redacted>");

    logger.info("message", { accessToken: "abc123" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { accessToken: "<redacted>" },
      }),
    );
  });

  test("should not match unrelated keys with regex filterKey", () => {
    logger.filterKey(/token/i);

    logger.info("message", { username: "alice", email: "a@b.com" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { username: "alice", email: "a@b.com" },
      }),
    );
  });

  test("should prioritize exact key over regex", () => {
    logger.filterKey("accessToken", () => "<exact>");
    logger.filterKey(/token/i, () => "<regex>");

    logger.info("message", { accessToken: "abc", refreshToken: "xyz" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { accessToken: "<exact>", refreshToken: "<regex>" },
      }),
    );
  });

  test("should share regex filterKey between parent and child", () => {
    const child = logger.child(["child"]);

    logger.filterKey(/secret/i);

    child.info("message", { mySecret: "hidden" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { mySecret: "[Filtered]" },
      }),
    );
  });

  // level gating

  test("should skip processing when level is disabled", () => {
    isLevelEnabled.mockReturnValueOnce(false);

    logger.debug("should not process");

    expect(log).not.toHaveBeenCalled();
  });

  test("should skip processing for all methods when level is disabled", () => {
    isLevelEnabled.mockReturnValue(false);

    logger.error("no");
    logger.warn("no");
    logger.info("no");
    logger.verbose("no");
    logger.debug("no");
    logger.silly("no");

    expect(log).not.toHaveBeenCalled();

    isLevelEnabled.mockReturnValue(true);
  });

  // isLevelEnabled

  test("should expose isLevelEnabled", () => {
    isLevelEnabled.mockReturnValueOnce(true);
    expect(logger.isLevelEnabled("info")).toBe(true);
    expect(isLevelEnabled).toHaveBeenCalledWith("info");

    isLevelEnabled.mockReturnValueOnce(false);
    expect(logger.isLevelEnabled("debug")).toBe(false);
    expect(isLevelEnabled).toHaveBeenCalledWith("debug");
  });

  // level getter/setter

  test("should get the current level", () => {
    expect(logger.level).toBe("info");
  });

  test("should set the level on winston and transports", () => {
    mockTransports.push({ level: "info" });

    logger.level = "debug";

    expect(mockTransports[0].level).toBe("debug");

    mockTransports.length = 0;
  });

  // time (LoggerTimer)

  test("should return a LoggerTimer from time()", () => {
    const timer = logger.time();

    expect(timer).toBeDefined();
    expect(typeof timer.debug).toBe("function");
    expect(typeof timer.info).toBe("function");
    expect(typeof timer.error).toBe("function");
    expect(typeof timer.warn).toBe("function");
    expect(typeof timer.verbose).toBe("function");
    expect(typeof timer.silly).toBe("function");
  });

  test("should log with duration via timer.debug()", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 150.123);

    const timer = logger.time();
    timer.debug("Operation complete", { extra: "data" });

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { extra: "data" },
        duration: expect.closeTo(150.123, 2),
        level: "debug",
        message: "Operation complete",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should log with duration via timer.info()", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 50.456);

    const timer = logger.time();
    timer.info("Done");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        duration: expect.closeTo(50.456, 2),
        level: "info",
        message: "Done",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should inherit parent logger scope and correlation", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 10);

    const child = logger.child(["child"], { requestId: "abc" });
    const timer = child.time();
    timer.silly("Timed");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: { requestId: "abc" },
        duration: expect.closeTo(10, 0),
        level: "silly",
        message: "Timed",
        scope: ["child"],
      }),
    );

    jest.restoreAllMocks();
  });

  test("should respect level gating for timer", () => {
    isLevelEnabled.mockReturnValueOnce(false);

    const timer = logger.time();
    timer.debug("should not log");

    expect(log).not.toHaveBeenCalled();
  });

  // time(label) / timeEnd(label)

  test("should log with default debug level via time(label)/timeEnd(label)", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 100);

    logger.time("my-operation");
    logger.timeEnd("my-operation");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: {},
        duration: expect.closeTo(100, 0),
        level: "debug",
        message: "my-operation",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should log with explicit level via timeEnd", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 200);

    logger.time("op");
    logger.timeEnd("op", "info");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.closeTo(200, 0),
        level: "info",
        message: "op",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should log with context and extra via timeEnd (no level)", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 50);

    logger.time("op");
    logger.timeEnd("op", { key: "value" }, [{ extra: true }]);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { key: "value" },
        duration: expect.closeTo(50, 0),
        extra: [{ extra: true }],
        level: "debug",
        message: "op",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should log with explicit level, context, and extra via timeEnd", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 75);

    logger.time("op");
    logger.timeEnd("op", "warn", { key: "value" }, [{ extra: true }]);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: { key: "value" },
        duration: expect.closeTo(75, 0),
        extra: [{ extra: true }],
        level: "warn",
        message: "op",
      }),
    );

    jest.restoreAllMocks();
  });

  test("should warn when timeEnd called with unknown label", () => {
    logger.timeEnd("unknown-label");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        message: 'Timer "unknown-label" does not exist',
      }),
    );
  });

  test("should allow child to inherit parent timers", () => {
    const now = performance.now();
    jest
      .spyOn(performance, "now")
      .mockReturnValueOnce(now)
      .mockReturnValueOnce(now + 30);

    logger.time("shared");
    const child = logger.child(["child"]);
    child.timeEnd("shared");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: expect.closeTo(30, 0),
        level: "debug",
        message: "shared",
        scope: ["child"],
      }),
    );

    jest.restoreAllMocks();
  });

  test("should not leak child timers to parent", () => {
    const now = performance.now();
    jest.spyOn(performance, "now").mockReturnValueOnce(now);

    const child = logger.child(["child"]);
    child.time("child-only");

    logger.timeEnd("child-only");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: "warn",
        message: 'Timer "child-only" does not exist',
      }),
    );

    jest.restoreAllMocks();
  });

  // error cause chain

  test("should extract error cause chain", () => {
    const cause = new Error("root cause");
    const error = new Error("outer error", { cause });

    logger.error(error);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          error: expect.any(Error),
          name: "Error",
          message: "outer error",
          stack: expect.any(Array),
          cause: expect.objectContaining({
            error: expect.any(Error),
            name: "Error",
            message: "root cause",
            stack: expect.any(Array),
          }),
        }),
      }),
    );
  });

  test("should extract deep error cause chain", () => {
    const root = new Error("root");
    const mid = new Error("mid", { cause: root });
    const outer = new Error("outer", { cause: mid });

    logger.error(outer);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          message: "outer",
          cause: expect.objectContaining({
            message: "mid",
            cause: expect.objectContaining({
              message: "root",
            }),
          }),
        }),
      }),
    );
  });

  test("should not add cause field when error has no cause", () => {
    const error = new Error("no cause");

    logger.error(error);

    const callArg = log.mock.calls[0][0];
    expect(callArg.context).not.toHaveProperty("cause");
  });

  // extra array processing

  test("should filter null/falsy values in extra array", () => {
    logger.info("message", {}, [null, undefined, { valid: true }]);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: [{ valid: true }],
      }),
    );
  });

  test("should extract errors in extra array", () => {
    const err = new Error("extra error");
    logger.info("message", {}, [err]);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: [
          expect.objectContaining({
            error: err,
            name: "Error",
            message: "extra error",
            stack: expect.any(Array),
          }),
        ],
      }),
    );
  });

  test("should filter content in extra array", () => {
    logger.filterPath("secret");

    logger.info("message", {}, [{ secret: "hidden", visible: "ok" }]);

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        extra: [{ secret: "[Filtered]", visible: "ok" }],
      }),
    );
  });
});
