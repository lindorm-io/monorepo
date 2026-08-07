import type { IAegis, VerifiedToken } from "@lindorm/aegis";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { ACCESS_TEST_ISSUER, createTestAegis } from "../../__fixtures__/access/aegis.js";
import type { PylonResolvedAccess } from "../../types/index.js";
import { resolveActor } from "./resolve-actor.js";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

/**
 * The default resolver is proved against a REAL minted-and-verified token, not a
 * hand-built `{ claims: { … } }` literal: the claim name it must read is decided
 * by aegis's wire→domain translation (`sub` → `subject`), and a literal simply
 * echoes whatever the test author believed it to be. This suite went red for
 * exactly that reason — the resolver read `claims.sub`, which a domain
 * `VerifiedToken` never carries.
 */
describe("resolveActor", () => {
  let aegis: IAegis;
  let accessToken: VerifiedToken;
  let idToken: VerifiedToken;
  let ctx: any;

  const mintAndVerify = async (
    subject: string,
    tokenType: "access_token" | "id_token",
  ): Promise<VerifiedToken> => {
    const { token } = await aegis.mint("default", {
      audience: [ACCESS_TEST_ISSUER],
      expires: "1 hour",
      subject,
      tokenType,
    });

    return aegis.verify(token, { issuer: ACCESS_TEST_ISSUER }, { tokenType });
  };

  beforeAll(async () => {
    aegis = createTestAegis(createMockLogger());

    accessToken = await mintAndVerify("alice", "access_token");
    idToken = await mintAndVerify("bob", "id_token");
  });

  beforeEach(() => {
    ctx = {
      state: {
        access: null,
        actor: "unknown",
        authorization: { type: "none", value: null },
        tokens: {},
      },
    };
  });

  describe("default resolver", () => {
    test("should resolve the subject of a real verified access token", () => {
      ctx.state.tokens.accessToken = accessToken;

      expect(accessToken.claims.subject).toBe("alice");
      expect(resolveActor(ctx)).toBe("alice");
    });

    test("should resolve the subject of a real verified id token when no access token is present", () => {
      ctx.state.tokens.idToken = idToken;

      expect(resolveActor(ctx)).toBe("bob");
    });

    test("should prefer the access token over the id token", () => {
      ctx.state.tokens.accessToken = accessToken;
      ctx.state.tokens.idToken = idToken;

      expect(resolveActor(ctx)).toBe("alice");
    });

    // The introspected path deliberately leaves `tokens.accessToken` UNSET —
    // there is no VerifiedToken to put there — so a resolver that only reads
    // `tokens` audits every introspection-authenticated request as "unknown".
    test("should resolve the subject of an introspected credential from ctx.state.access", () => {
      ctx.state.access = {
        provenance: "introspected",
        token: "opaque-token",
        claims: { subject: "carol" },
      } as PylonResolvedAccess;

      expect(resolveActor(ctx)).toBe("carol");
    });

    test("should resolve the subject of a verified credential from ctx.state.access", () => {
      ctx.state.access = {
        provenance: "verified",
        token: accessToken.token,
        claims: accessToken.claims,
      } as PylonResolvedAccess;

      expect(resolveActor(ctx)).toBe("alice");
    });

    // `access` is the credential this request authenticated WITH; `tokens` is the
    // session's token set. When both are present the authenticating one wins.
    test("should prefer ctx.state.access over ctx.state.tokens", () => {
      ctx.state.access = {
        provenance: "introspected",
        token: "opaque-token",
        claims: { subject: "carol" },
      } as PylonResolvedAccess;
      ctx.state.tokens.accessToken = accessToken;

      expect(resolveActor(ctx)).toBe("carol");
    });

    test("should resolve the username from basic authorization", () => {
      ctx.state.authorization = {
        type: "basic",
        value: Buffer.from("carol:secret", "utf-8").toString("base64"),
      };

      expect(resolveActor(ctx)).toBe("carol");
    });

    test("should prefer a token subject over a basic-auth username", () => {
      ctx.state.tokens.accessToken = accessToken;
      ctx.state.authorization = {
        type: "basic",
        value: Buffer.from("carol:secret", "utf-8").toString("base64"),
      };

      expect(resolveActor(ctx)).toBe("alice");
    });

    test("should ignore malformed basic authorization", () => {
      ctx.state.authorization = { type: "basic", value: "!!!not-base64" };

      // Buffer.from does not throw on invalid base64; it decodes gibberish that
      // still splits on ":" safely. The guarantee is no throw and a string result.
      expect(typeof resolveActor(ctx)).toBe("string");
    });

    test("should ignore a basic authorization with an empty username", () => {
      ctx.state.authorization = {
        type: "basic",
        value: Buffer.from(":secret", "utf-8").toString("base64"),
      };

      expect(resolveActor(ctx)).toBe("unknown");
    });

    test("should return 'unknown' when no auth info is present", () => {
      expect(resolveActor(ctx)).toBe("unknown");
    });

    test("should ignore a non-string subject claim", () => {
      ctx.state.access = {
        provenance: "introspected",
        token: "opaque-token",
        claims: { subject: 12345 },
      } as unknown as PylonResolvedAccess;

      expect(resolveActor(ctx)).toBe("unknown");
    });

    test("should ignore an empty subject claim", () => {
      ctx.state.access = {
        provenance: "introspected",
        token: "opaque-token",
        claims: { subject: "" },
      } as PylonResolvedAccess;

      expect(resolveActor(ctx)).toBe("unknown");
    });

    test("should memoise a resolved token subject onto ctx.state.actor", () => {
      ctx.state.tokens.accessToken = accessToken;

      resolveActor(ctx);

      expect(ctx.state.actor).toBe("alice");
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

    // A configured resolver replaces the default outright — a token on the
    // context must not leak past it.
    test("should not fall back to the default resolver when one is configured", () => {
      ctx.state.tokens.accessToken = accessToken;
      const resolver = vi.fn().mockReturnValue("custom-actor");

      expect(resolveActor(ctx, resolver)).toBe("custom-actor");
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

    test("should resolve to 'unknown' rather than throw when ctx.state is missing", () => {
      expect(resolveActor({} as any)).toBe("unknown");
    });
  });
});
