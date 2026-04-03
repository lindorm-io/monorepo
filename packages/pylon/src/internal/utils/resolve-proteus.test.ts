import { ServerError } from "@lindorm/errors";
import { resolveProteus } from "./resolve-proteus";

describe("resolveProteus", () => {
  test("should return cloned override when override is provided", () => {
    const cloned = { fake: "cloned" };
    const override: any = { clone: jest.fn().mockReturnValue(cloned) };
    const ctx: any = { logger: { fake: "logger" } };

    const result = resolveProteus(ctx, override);

    expect(result).toBe(cloned);
    expect(override.clone).toHaveBeenCalledWith({ logger: ctx.logger });
  });

  test("should return ctx.proteus when no override and ctx.proteus exists", () => {
    const proteus = { fake: "proteus" };
    const ctx: any = { logger: {}, proteus };

    const result = resolveProteus(ctx);

    expect(result).toBe(proteus);
  });

  test("should throw ServerError when no override and no ctx.proteus", () => {
    const ctx: any = { logger: {} };

    expect(() => resolveProteus(ctx)).toThrow(ServerError);
    expect(() => resolveProteus(ctx)).toThrow("ProteusSource is not configured");
  });

  test("should prefer override over ctx.proteus", () => {
    const cloned = { fake: "cloned" };
    const override: any = { clone: jest.fn().mockReturnValue(cloned) };
    const ctx: any = { logger: {}, proteus: { fake: "existing" } };

    const result = resolveProteus(ctx, override);

    expect(result).toBe(cloned);
  });
});
