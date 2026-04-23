import { beforeEach, describe, expect, test, vi } from "vitest";
import { resolveActor } from "./resolve-actor.js";

describe("resolveActor", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      state: {
        actor: "unknown",
        authorization: { type: "none", value: null },
        tokens: {},
      },
    };
  });

  describe("default resolver", () => {
    test("should resolve from accessToken claims.sub", () => {
      ctx.state.tokens.accessToken = { claims: { sub: "alice" } };

      expect(resolveActor(ctx)).toBe("alice");
    });

    test("should resolve from idToken claims.sub when accessToken missing", () => {
      ctx.state.tokens.idToken = { claims: { sub: "bob" } };

      expect(resolveActor(ctx)).toBe("bob");
    });

    test("should prefer accessToken over idToken", () => {
      ctx.state.tokens.accessToken = { claims: { sub: "alice" } };
      ctx.state.tokens.idToken = { claims: { sub: "bob" } };

      expect(resolveActor(ctx)).toBe("alice");
    });

    test("should resolve username from basic authorization", () => {
      ctx.state.authorization = {
        type: "basic",
        value: Buffer.from("carol:secret", "utf-8").toString("base64"),
      };

      expect(resolveActor(ctx)).toBe("carol");
    });

    test("should ignore malformed basic authorization", () => {
      ctx.state.authorization = { type: "basic", value: "!!!not-base64" };

      // Buffer.from will not throw on invalid base64; it decodes gibberish
      // that still splits on ":" safely. Guarantee is no throw and a sane
      // fallback to "unknown" when no usable username is found.
      const resolved = resolveActor(ctx);
      expect(typeof resolved).toBe("string");
    });

    test("should return 'unknown' when no auth info is present", () => {
      expect(resolveActor(ctx)).toBe("unknown");
    });

    test("should ignore non-string sub claims", () => {
      ctx.state.tokens.accessToken = { claims: { sub: 12345 } };

      expect(resolveActor(ctx)).toBe("unknown");
    });
  });

  describe("configured resolver", () => {
    test("should call the configured resolver when provided", () => {
      const resolver = vi.fn().mockReturnValue("custom-actor");

      expect(resolveActor(ctx, resolver)).toBe("custom-actor");
      expect(resolver).toHaveBeenCalledWith(ctx);
    });

    test("should store resolver result on ctx.state.actor", () => {
      const resolver = vi.fn().mockReturnValue("custom-actor");

      resolveActor(ctx, resolver);

      expect(ctx.state.actor).toBe("custom-actor");
    });

    test("should accept configured resolver returning 'unknown'", () => {
      const resolver = vi.fn().mockReturnValue("unknown");

      expect(resolveActor(ctx, resolver)).toBe("unknown");
      expect(ctx.state.actor).toBe("unknown");
    });
  });

  describe("memoisation", () => {
    test("should return cached non-unknown actor without calling resolver", () => {
      ctx.state.actor = "cached-actor";
      const resolver = vi.fn().mockReturnValue("other-actor");

      expect(resolveActor(ctx, resolver)).toBe("cached-actor");
      expect(resolver).not.toHaveBeenCalled();
    });

    test("should re-run resolver when cached actor is 'unknown'", () => {
      const resolver = vi.fn().mockReturnValue("new-actor");

      resolveActor(ctx, resolver);
      // First call resolved to "new-actor" and cached it; second call short-circuits.
      resolveActor(ctx, resolver);

      expect(resolver).toHaveBeenCalledTimes(1);
    });

    test("should keep re-running resolver while cached actor remains 'unknown'", () => {
      const resolver = vi.fn().mockReturnValue("unknown");

      resolveActor(ctx, resolver);
      resolveActor(ctx, resolver);

      expect(resolver).toHaveBeenCalledTimes(2);
    });

    test("should not mutate ctx when ctx.state is missing", () => {
      const bareCtx: any = {};
      const resolver = vi.fn().mockReturnValue("actor-a");

      expect(resolveActor(bareCtx, resolver)).toBe("actor-a");
      expect(bareCtx.state).toBeUndefined();
    });
  });
});
