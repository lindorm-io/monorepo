import { ClientError } from "@lindorm/errors";
import { createUnconfiguredAuthClient } from "../../internal/utils/auth/create-unconfigured-auth-client.js";
import type { PylonResolvedAccess } from "../../types/index.js";
import { useAccess } from "./use-access.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("useAccess", () => {
  let ctx: any;

  const access = (
    provenance: PylonResolvedAccess["provenance"],
    claims: Record<string, unknown> = {},
  ): PylonResolvedAccess =>
    ({
      provenance,
      token: "presented-token",
      custom: {},
      claims: {
        roles: ["user"],
        permissions: ["users:read"],
        scope: ["openid"],
        levelOfAssurance: 2,
        ...claims,
      },
    }) as PylonResolvedAccess;

  beforeEach(() => {
    ctx = {
      // No `options.auth` configured: every ctx.auth method throws
      // `auth_not_configured`. useAccess must never touch it.
      auth: createUnconfiguredAuthClient(),
      state: {
        access: access("verified"),
        tokens: {},
      },
    };
  });

  describe("resolved access", () => {
    test("should call next when all checks pass with NO auth configured", async () => {
      const next = vi.fn();

      await expect(
        useAccess({
          roles: ["user"],
          permissions: ["users:read"],
          scope: ["openid"],
          levelOfAssurance: 2,
        })(ctx, next),
      ).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should never call ctx.auth.introspect", async () => {
      ctx.auth.introspect = vi.fn();

      await useAccess({ roles: ["user"] })(ctx, vi.fn());

      expect(ctx.auth.introspect).not.toHaveBeenCalled();
    });

    test("should gate an introspected credential exactly as a verified one", async () => {
      ctx.state.access = access("introspected");
      const next = vi.fn();

      await expect(
        useAccess({ roles: ["user"], scope: ["openid"] })(ctx, next),
      ).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
    });

    // A SCALAR matcher against an array-valued claim means "must contain this
    // one value" — the form a resource server writes for its own audience, and
    // the one this suite never exercised while it only ever passed arrays.
    test("should accept a scalar audience the token contains", async () => {
      ctx.state.access = access("verified", {
        audience: ["https://api.test", "https://other.test"],
      });
      const next = vi.fn();

      await expect(
        useAccess({ audience: "https://api.test", scope: "openid" })(ctx, next),
      ).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should throw 403 when the token audience lacks the scalar matcher", async () => {
      ctx.state.access = access("verified", { audience: ["https://other.test"] });

      try {
        await useAccess({ audience: "https://api.test" })(ctx, vi.fn());
        throw new Error("expected useAccess to throw");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ClientError);
        expect(err.status).toBe(403);
        expect(err.data.invalid).toEqual(["audience"]);
      }
    });

    test("should throw 401 when the access token middleware has not run", async () => {
      ctx.state.access = null;

      await expect(useAccess({ roles: ["user"] })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ roles: ["user"] })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("access_not_resolved");
        expect(err.message).toMatchSnapshot();
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when roles check fails", async () => {
      await expect(
        useAccess({ roles: ["admin", "superadmin"] })(ctx, vi.fn()),
      ).rejects.toThrow(ClientError);

      try {
        await useAccess({ roles: ["admin", "superadmin"] })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toMatchSnapshot();
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when permissions check fails", async () => {
      await expect(
        useAccess({ permissions: ["users:read", "users:delete"] })(ctx, vi.fn()),
      ).rejects.toThrow(ClientError);

      try {
        await useAccess({ permissions: ["users:read", "users:delete"] })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toMatchSnapshot();
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when scopes check fails", async () => {
      await expect(
        useAccess({ scope: ["admin:all", "system:write"] })(ctx, vi.fn()),
      ).rejects.toThrow(ClientError);

      try {
        await useAccess({ scope: ["admin:all", "system:write"] })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.message).toMatchSnapshot();
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when levelOfAssurance is too low", async () => {
      await expect(useAccess({ levelOfAssurance: 3 })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ levelOfAssurance: 3 })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when levelOfAssurance is absent on an introspected credential", async () => {
      ctx.state.access = access("introspected", { levelOfAssurance: undefined });

      await expect(useAccess({ levelOfAssurance: 1 })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ levelOfAssurance: 1 })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should collect all violations into a single error message", async () => {
      try {
        await useAccess({
          roles: ["admin"],
          permissions: ["admin:write"],
          scope: ["admin:all"],
          levelOfAssurance: 4,
        })(ctx, vi.fn());
        expect.fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ClientError);
        expect(err.status).toBe(403);
        expect(err.details).toMatchSnapshot();
      }
    });
  });

  describe("custom token key", () => {
    beforeEach(() => {
      ctx.state.tokens.idToken = {
        format: "jwt",
        claims: {
          roles: ["viewer"],
          permissions: ["profile:read"],
          scope: ["openid"],
          levelOfAssurance: 3,
        },
      };
    });

    test("should read the named token, not the resolved access", async () => {
      const next = vi.fn();

      await expect(
        useAccess({
          roles: ["viewer"],
          permissions: ["profile:read"],
          token: "idToken",
        })(ctx, next),
      ).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should read the named token even when no access is resolved", async () => {
      ctx.state.access = null;
      const next = vi.fn();

      await expect(
        useAccess({ roles: ["viewer"], token: "idToken" })(ctx, next),
      ).resolves.toBeUndefined();

      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should throw 401 when custom token is missing", async () => {
      await expect(
        useAccess({ roles: ["user"], token: "customToken" })(ctx, vi.fn()),
      ).rejects.toThrow(ClientError);

      try {
        await useAccess({ roles: ["user"], token: "customToken" })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.code).toBe("token_not_found");
      }
    });
  });
});
