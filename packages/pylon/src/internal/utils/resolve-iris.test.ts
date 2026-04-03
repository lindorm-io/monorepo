import { ServerError } from "@lindorm/errors";
import { resolveIris } from "./resolve-iris";

describe("resolveIris", () => {
  test("should return cloned override when override is provided", () => {
    const cloned = { fake: "cloned" };
    const override: any = { clone: jest.fn().mockReturnValue(cloned) };
    const ctx: any = { logger: { fake: "logger" } };

    const result = resolveIris(ctx, override);

    expect(result).toBe(cloned);
    expect(override.clone).toHaveBeenCalledWith({ logger: ctx.logger });
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
    const cloned = { fake: "cloned" };
    const override: any = { clone: jest.fn().mockReturnValue(cloned) };
    const ctx: any = { logger: {}, iris: { fake: "existing" } };

    const result = resolveIris(ctx, override);

    expect(result).toBe(cloned);
  });
});
