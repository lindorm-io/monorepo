import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { socketLoggerMiddleware } from "./socket-logger-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("socketLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      event: "event",
      args: "args",
    };
  });

  test("should log event received and resolved", async () => {
    await expect(socketLoggerMiddleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.logger.info).toHaveBeenCalledWith("Socket event received", {
      event: "event",
      args: "args",
    });

    expect(ctx.logger.info).toHaveBeenCalledWith("Socket event resolved", {
      event: "event",
      args: "args",
      time: expect.any(Number),
    });
  });

  test("should propagate errors without catching", async () => {
    const next = () => Promise.reject(new Error("test error"));

    await expect(socketLoggerMiddleware(ctx, next)).rejects.toThrow("test error");
  });

  test("should call next", async () => {
    const next = vi.fn();

    await socketLoggerMiddleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
