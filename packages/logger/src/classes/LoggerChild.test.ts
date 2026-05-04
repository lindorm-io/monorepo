import MockDate from "mockdate";
import { Logger } from "./Logger.js";
import { LoggerBase } from "./LoggerBase.js";
import { LoggerChild } from "./LoggerChild.js";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

const { add, log, isLevelEnabled, mockTransports } = vi.hoisted(() => ({
  add: vi.fn(),
  log: vi.fn(),
  isLevelEnabled: vi.fn().mockReturnValue(true),
  mockTransports: [] as Array<{ level?: string }>,
}));

vi.mock("winston", async () => {
  const actual = await vi.importActual<typeof import("winston")>("winston");
  const createLogger = vi.fn(() => ({
    add,
    isLevelEnabled,
    log,
    level: "info",
    transports: mockTransports,
  }));
  return {
    ...actual,
    createLogger,
    default: { ...actual, createLogger },
  };
});

describe("LoggerChild", () => {
  let root: Logger;

  beforeEach(() => {
    root = new Logger();
  });

  afterEach(vi.clearAllMocks);

  test("should be a LoggerBase instance and report __instanceof: Logger", () => {
    const child = root.child();

    expect(child).toBeInstanceOf(LoggerChild);
    expect(child).toBeInstanceOf(LoggerBase);
    expect(child.__instanceof).toBe("Logger");
  });

  test("should not create a new winston instance (shares with parent)", () => {
    add.mockClear();
    root.child();
    root.child();
    root.child();

    expect(add).not.toHaveBeenCalled();
  });

  test("should not register additional process listeners", () => {
    const before = process.listenerCount("uncaughtException");
    const beforeRej = process.listenerCount("unhandledRejection");

    root.child();
    root.child();

    expect(process.listenerCount("uncaughtException")).toBe(before);
    expect(process.listenerCount("unhandledRejection")).toBe(beforeRej);
  });

  test("should inherit and extend correlation from parent", () => {
    root.correlation({ traceId: "trace-1" });
    const child = root.child({ requestId: "req-1" });

    child.info("hello");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: { traceId: "trace-1", requestId: "req-1" },
      }),
    );
  });

  test("should inherit and extend scope from parent", () => {
    root.scope(["app"]);
    const child = root.child(["request"]);

    child.info("hello");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: ["app", "request"],
      }),
    );
  });

  test("should clone the timer map so siblings don't share running timers", () => {
    root.time("a");
    const child = root.child();

    // @ts-expect-error — touching protected state for the test
    expect(child.timers.has("a")).toBe(true);

    child.time("b");

    // @ts-expect-error
    expect(root.timers.has("b")).toBe(false);
  });

  test("child of child should also be a LoggerChild", () => {
    const grandchild = root.child(["a"]).child(["b"]);

    expect(grandchild).toBeInstanceOf(LoggerChild);
    expect(grandchild.__instanceof).toBe("Logger");
  });

  test("should accept LoggerBaseOptions directly when constructed standalone", () => {
    const direct = new LoggerChild({
      correlation: { direct: "yes" },
      filters: {},
      filterRef: { entries: [] },
      keyFilterRef: { exact: new Map(), patterns: [] },
      scope: ["direct"],
      timers: new Map(),
      // @ts-expect-error — using the mocked winston shape from the test
      winston: { add, isLevelEnabled, log, level: "info", transports: mockTransports },
    });

    direct.info("hello");

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        correlation: { direct: "yes" },
        scope: ["direct"],
      }),
    );
  });
});
