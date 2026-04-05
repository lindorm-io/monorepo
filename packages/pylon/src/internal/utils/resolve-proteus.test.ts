import { ServerError } from "@lindorm/errors";
import { resolveProteus } from "./resolve-proteus";

describe("resolveProteus", () => {
  test("should return session from override when override is provided", () => {
    const session = { fake: "session" };
    const override: any = { session: jest.fn().mockReturnValue(session) };
    const ctx: any = { logger: { fake: "logger" } };

    const result = resolveProteus(ctx, override);

    expect(result).toBe(session);
    expect(override.session).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
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
    const session = { fake: "session" };
    const override: any = { session: jest.fn().mockReturnValue(session) };
    const ctx: any = { logger: {}, proteus: { fake: "existing" } };

    const result = resolveProteus(ctx, override);

    expect(result).toBe(session);
  });
});
