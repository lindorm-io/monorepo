import { createMockLogger } from "@lindorm/logger";
import { eventLoggerMiddleware } from "./event-logger-middleware";

describe("eventLoggerMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),

      event: "event",
      args: "args",
    };
  });

  test("should log  information", async () => {
    await expect(eventLoggerMiddleware(ctx, jest.fn())).resolves.toBeUndefined();

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

    await expect(eventLoggerMiddleware(ctx, next)).resolves.toBeUndefined();

    expect(ctx.logger.error).toHaveBeenCalledWith(new Error("error"));
  });
});
