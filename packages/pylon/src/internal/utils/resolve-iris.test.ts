import { ServerError } from "@lindorm/errors";
import { resolveIris } from "./resolve-iris.js";
import { describe, expect, test, vi } from "vitest";

describe("resolveIris", () => {
  test("should return session from override when override is provided", () => {
    const session = { fake: "session" };
    const override: any = { session: vi.fn().mockReturnValue(session) };
    const ctx: any = {
      logger: { fake: "logger" },
      state: { metadata: { correlationId: "corr-x" } },
    };

    const result = resolveIris(ctx, override);

    expect(result).toBe(session);
    expect(override.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      context: {
        correlationId: "corr-x",
        actor: null,
        timestamp: expect.any(Date),
      },
    });
  });

  test("should return ctx.iris when no override and ctx.iris exists", () => {
    const iris = { fake: "iris" };
    const ctx: any = { logger: {}, iris };

    const result = resolveIris(ctx);

    expect(result).toBe(iris);
  });

  test("should throw ServerError when no override and no ctx.iris", () => {
    const ctx: any = { logger: {} };

    expect(() => resolveIris(ctx)).toThrow(ServerError);
    expect(() => resolveIris(ctx)).toThrow("IrisSource is not configured");
  });

  test("should prefer override over ctx.iris", () => {
    const session = { fake: "session" };
    const override: any = { session: vi.fn().mockReturnValue(session) };
    const ctx: any = { logger: {}, iris: { fake: "existing" } };

    const result = resolveIris(ctx, override);

    expect(result).toBe(session);
  });
});
