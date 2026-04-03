import { createMockLogger } from "@lindorm/logger";
import { socketLoggerMiddleware } from "./socket-logger-middleware";

describe("socketLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),

      event: "event",
      args: "args",
    };
  });

  test("should log  information", async () => {
    await expect(socketLoggerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

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

  test("should log  error", async () => {
    const next = () => Promise.reject(new Error("error"));

    await expect(socketLoggerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.logger.error).toHaveBeenCalledWith(new Error("error"));
  });
});
