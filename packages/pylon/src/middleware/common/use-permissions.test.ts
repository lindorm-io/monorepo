import { ClientError } from "@lindorm/errors";
import { createUnconfiguredAuthClient } from "../../internal/utils/auth/create-unconfigured-auth-client.js";
import type { PylonResolvedAccess } from "../../types/index.js";
import { usePermissions } from "./use-permissions.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("usePermissions", () => {
  let ctx: any;

  const access = (provenance: PylonResolvedAccess["provenance"]): PylonResolvedAccess =>
    ({
      provenance,
      token: "presented-token",
      custom: {},
      claims: {
        permissions: ["users:read", "users:write"],
        roles: [],
        scope: [],
      },
    }) as PylonResolvedAccess;

  beforeEach(() => {
    ctx = {
      // No `options.auth` configured — usePermissions must never reach for it.
      auth: createUnconfiguredAuthClient(),
      state: {
        access: access("verified"),
        tokens: {},
      },
    };
  });

  test("should call next when all permissions are present", async () => {
    const next = vi.fn();

    await expect(usePermissions("users:read")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should support multiple permissions (AND logic)", async () => {
    const next = vi.fn();

    await expect(
      usePermissions("users:read", "users:write")(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should gate an introspected credential exactly as a verified one", async () => {
    ctx.state.access = access("introspected");
    const next = vi.fn();

    await expect(usePermissions("users:read")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should not require a parsed token in ctx.state.tokens", async () => {
    ctx.state.tokens = {};
    const next = vi.fn();

    await expect(usePermissions("users:write")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError 403 when a permission is missing", async () => {
    await expect(
      usePermissions("users:read", "users:delete")(ctx, vi.fn()),
    ).rejects.toThrow(ClientError);

    try {
      await usePermissions("users:read", "users:delete")(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw ClientError 401 when the access token middleware has not run", async () => {
    ctx.state.access = null;

    await expect(usePermissions("users:read")(ctx, vi.fn())).rejects.toThrow(ClientError);

    try {
      await usePermissions("users:read")(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.code).toBe("access_not_resolved");
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should support custom token key via options", async () => {
    ctx.state.tokens.idToken = {
      claims: {
        permissions: ["profile:read"],
        roles: [],
        scope: [],
      },
    };

    const next = vi.fn();

    await expect(
      usePermissions("profile:read", { token: "idToken" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError 401 when a named token is missing", async () => {
    await expect(
      usePermissions("profile:read", { token: "idToken" })(ctx, vi.fn()),
    ).rejects.toThrow(ClientError);

    try {
      await usePermissions("profile:read", { token: "idToken" })(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.code).toBe("token_not_found");
    }
  });

  test("should throw at factory time if no permissions are provided", () => {
    expect(() => usePermissions()).toThrow(Error);
    expect(() => usePermissions()).toThrow(
      "usePermissions requires at least one permission",
    );
  });

  test("should throw at factory time if only options are provided", () => {
    expect(() => usePermissions({ token: "idToken" })).toThrow(Error);
  });
});
