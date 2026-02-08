import { InternalLog } from "../../types/private";
import { readableFormat } from "./readable-format";

const makeLog = (overrides: Partial<InternalLog> = {}): InternalLog => ({
  context: {},
  correlation: {},
  extra: [],
  level: "info",
  message: "test message",
  scope: [],
  time: new Date("2024-01-01T08:00:00.000Z"),
  ...overrides,
});

describe("readableFormat", () => {
  test("should format a basic log message", () => {
    const result = readableFormat(makeLog());
    expect(result).toContain("INFO");
    expect(result).toContain("test message");
    expect(result).toContain("2024-01-01T08:00:00.000Z");
  });

  test("should include scope when present", () => {
    const result = readableFormat(makeLog({ scope: ["app", "service"] }));
    expect(result).toContain("[ app | service ]");
  });

  test("should not include scope brackets when empty", () => {
    const result = readableFormat(makeLog({ scope: [] }));
    expect(result).not.toContain("[ ");
  });

  test("should format all log levels", () => {
    expect(readableFormat(makeLog({ level: "error" }))).toContain("ERROR");
    expect(readableFormat(makeLog({ level: "warn" }))).toContain("WARN");
    expect(readableFormat(makeLog({ level: "info" }))).toContain("INFO");
    expect(readableFormat(makeLog({ level: "verbose" }))).toContain("VERBOSE");
    expect(readableFormat(makeLog({ level: "debug" }))).toContain("DEBUG");
    expect(readableFormat(makeLog({ level: "silly" }))).toContain("SILLY");
  });

  test("should include context data", () => {
    const result = readableFormat(makeLog({ context: { key: "value" } }));
    expect(result).toContain("key");
    expect(result).toContain("value");
  });

  test("should skip empty context", () => {
    const result = readableFormat(makeLog({ context: {} }));
    // should only be the one-line preamble, no extra newline for content
    expect(result.split("\n")).toHaveLength(1);
  });

  test("should include extra data", () => {
    const result = readableFormat(makeLog({ extra: [{ extra1: "a" }, { extra2: "b" }] }));
    expect(result).toContain("extra1");
    expect(result).toContain("extra2");
  });

  test("should format extracted error context", () => {
    // In practice, Logger.extractErrorData() converts Error to { error, name, message, stack }
    // before it reaches readableFormat. Test with that shape.
    const error = new Error("something broke");
    const result = readableFormat(
      makeLog({
        context: { error, name: "Error", message: "something broke", stack: [] },
      }),
    );
    expect(result).toContain("something broke");
  });

  test("should format error in context object", () => {
    const error = new Error("wrapped error");
    const result = readableFormat(makeLog({ context: { error } }));
    expect(result).toContain("wrapped error");
  });

  test("should format duration in microseconds", () => {
    const result = readableFormat(makeLog({ duration: 0.042 }));
    expect(result).toContain("(42µs)");
  });

  test("should format duration in milliseconds and microseconds", () => {
    const result = readableFormat(makeLog({ duration: 3.5 }));
    expect(result).toContain("(3ms 500µs)");
  });

  test("should format duration in seconds and milliseconds", () => {
    const result = readableFormat(makeLog({ duration: 1234 }));
    expect(result).toContain("(1s 234ms)");
  });

  test("should format duration in minutes and seconds", () => {
    const result = readableFormat(makeLog({ duration: 93000 }));
    expect(result).toContain("(1m 33s)");
  });

  test("should format duration in hours, minutes, and seconds", () => {
    const result = readableFormat(makeLog({ duration: 9184000 }));
    expect(result).toContain("(2h 33m 4s)");
  });

  test("should place duration before scope", () => {
    const result = readableFormat(makeLog({ duration: 42, scope: ["http"] }));
    const durationIdx = result.indexOf("(42ms)");
    const scopeIdx = result.indexOf("[ http ]");
    expect(durationIdx).toBeGreaterThan(-1);
    expect(scopeIdx).toBeGreaterThan(-1);
    expect(durationIdx).toBeLessThan(scopeIdx);
  });

  test("should not include duration when absent", () => {
    const result = readableFormat(makeLog());
    expect(result).not.toContain("µs");
    expect(result).not.toContain("ms");
  });

  test("should format zero duration", () => {
    const result = readableFormat(makeLog({ duration: 0 }));
    expect(result).toContain("(0µs)");
  });

  test("should return JSON fallback on format error", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => {});

    const badLog = makeLog();
    // force an error by making time.toISOString throw
    badLog.time = {
      toISOString: () => {
        throw new Error("bad");
      },
    } as any;
    const result = readableFormat(badLog);
    // should fall back to fastSafeStringify
    expect(result).toContain("test message");
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
  });
});
