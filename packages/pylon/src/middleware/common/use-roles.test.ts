import { ClientError } from "@lindorm/errors";
import { createUnconfiguredAuthClient } from "../../internal/utils/auth/create-unconfigured-auth-client.js";
import type { PylonResolvedAccess } from "../../types/index.js";
import { useRoles } from "./use-roles.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("useRoles", () => {
  let ctx: any;

  const access = (provenance: PylonResolvedAccess["provenance"]): PylonResolvedAccess =>
    ({
      provenance,
      token: "presented-token",
      claims: {
        permissions: [],
        roles: ["admin", "user"],
        scope: [],
      },
    }) as PylonResolvedAccess;

  beforeEach(() => {
    ctx = {
      // No `options.auth` configured — useRoles must never reach for it.
      auth: createUnconfiguredAuthClient(),
      state: {
        access: access("verified"),
        tokens: {},
      },
    };
  });

  test("should call next when at least one role matches (OR logic)", async () => {
    const next = vi.fn();

    await expect(useRoles("user", "superadmin")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  // ⚠ The whole point of reading `ctx.state.access`: an introspected credential
  // populates it and nothing else, so a `tokens`-only gate let the same request
  // pass usePermissions and fail useRoles with `token_not_found`.
  test("should gate an introspected credential exactly as a verified one", async () => {
    ctx.state.access = access("introspected");
    const next = vi.fn();

    await expect(useRoles("admin")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should not require a parsed token in ctx.state.tokens", async () => {
    ctx.state.tokens = {};
    const next = vi.fn();

    await expect(useRoles("admin")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError 403 when no role matches", async () => {
    await expect(useRoles("superadmin", "moderator")(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useRoles("superadmin", "moderator")(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw ClientError 401 when the access token middleware has not run", async () => {
    ctx.state.access = null;

    await expect(useRoles("admin")(ctx, vi.fn())).rejects.toThrow(ClientError);

    try {
      await useRoles("admin")(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.code).toBe("access_not_resolved");
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should support custom token key", async () => {
    ctx.state.tokens.idToken = {
      claims: {
        permissions: [],
        roles: ["viewer"],
        scope: [],
      },
    };

    const next = vi.fn();

    await expect(
      useRoles("viewer", { token: "idToken" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError 401 when a named token is missing", async () => {
    await expect(useRoles("viewer", { token: "idToken" })(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useRoles("viewer", { token: "idToken" })(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.code).toBe("token_not_found");
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw at factory time if no roles are provided", () => {
    expect(() => useRoles()).toThrow(Error);
    expect(() => useRoles()).toThrow("useRoles requires at least one role");
  });

  test("should throw at factory time if only options are provided", () => {
    expect(() => useRoles({ token: "idToken" })).toThrow(Error);
  });
});
