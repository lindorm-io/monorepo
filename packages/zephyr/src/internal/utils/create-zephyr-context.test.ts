import { createZephyrContext } from "./create-zephyr-context.js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lindorm/random", () => ({
  randomUUID: vi.fn().mockReturnValue("mock-uuid"),
}));

describe("createZephyrContext", () => {
  const app = {
    alias: "test-app",
    url: "http://test.example.com",
    environment: null,
  };

  it("should create outgoing context with data", () => {
    const ctx = createZephyrContext({
      app,
      event: "test:event",
      data: { key: "value" },
    });

    expect(ctx).toMatchSnapshot();
  });

  it("should create outgoing context with default empty data", () => {
    const ctx = createZephyrContext({
      app,
      event: "test:event",
    });

    expect(ctx).toMatchSnapshot();
  });

  it("should create incoming context with data", () => {
    const ctx = createZephyrContext({
      app,
      event: "test:event",
      data: { result: "ok" },
      incoming: true,
    });

    expect(ctx).toMatchSnapshot();
  });

  it("should include logger when provided", () => {
    const mockLogger = { child: vi.fn() } as any;

    const ctx = createZephyrContext({
      app,
      event: "test:event",
      logger: mockLogger,
    });

    expect(ctx.logger).toBe(mockLogger);
  });
});
