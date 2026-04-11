import {
  isHttpContext,
  isSocketContext,
  isSocketEventContext,
  isSocketHandshakeContext,
} from "./is-context";

describe("isSocketEventContext", () => {
  test("should return true for socket event context", () => {
    expect(isSocketEventContext({ event: "test" } as any)).toBe(true);
  });

  test("should return false for HTTP context", () => {
    expect(isSocketEventContext({ request: {} } as any)).toBe(false);
  });

  test("should return false for socket handshake context (no event)", () => {
    expect(isSocketEventContext({ io: { socket: {} } } as any)).toBe(false);
  });

  test("should return false when neither is present", () => {
    expect(isSocketEventContext({} as any)).toBe(false);
  });
});

describe("isSocketHandshakeContext", () => {
  test("should return true for handshake context", () => {
    expect(isSocketHandshakeContext({ io: { socket: {} } } as any)).toBe(true);
  });

  test("should return false for socket event context (has event)", () => {
    expect(isSocketHandshakeContext({ event: "test", io: { socket: {} } } as any)).toBe(
      false,
    );
  });

  test("should return false for HTTP context", () => {
    expect(isSocketHandshakeContext({ request: {} } as any)).toBe(false);
  });

  test("should return false when io.socket is missing", () => {
    expect(isSocketHandshakeContext({ io: {} } as any)).toBe(false);
  });
});

describe("isSocketContext", () => {
  test("should return true for event context", () => {
    expect(isSocketContext({ event: "test" } as any)).toBe(true);
  });

  test("should return true for handshake context", () => {
    expect(isSocketContext({ io: { socket: {} } } as any)).toBe(true);
  });

  test("should return false for HTTP context", () => {
    expect(isSocketContext({ request: {} } as any)).toBe(false);
  });

  test("should return false for empty context", () => {
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
