import { isHttpContext, isSocketContext } from "./is-context";

describe("isSocketContext", () => {
  test("should return true for socket context", () => {
    expect(isSocketContext({ event: "test" } as any)).toBe(true);
  });

  test("should return false for HTTP context", () => {
    expect(isSocketContext({ request: {} } as any)).toBe(false);
  });

  test("should return false when both event and request are present", () => {
    expect(isSocketContext({ event: "test", request: {} } as any)).toBe(false);
  });

  test("should return false when neither is present", () => {
    expect(isSocketContext({} as any)).toBe(false);
  });
});

describe("isHttpContext", () => {
  test("should return true for HTTP context", () => {
    expect(isHttpContext({ request: {} } as any)).toBe(true);
  });

  test("should return false for socket context", () => {
    expect(isHttpContext({ event: "test" } as any)).toBe(false);
  });

  test("should return false when both event and request are present", () => {
    expect(isHttpContext({ event: "test", request: {} } as any)).toBe(false);
  });

  test("should return false when neither is present", () => {
    expect(isHttpContext({} as any)).toBe(false);
  });
});
