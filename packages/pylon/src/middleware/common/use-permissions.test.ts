import { ClientError } from "@lindorm/errors";
import { usePermissions } from "./use-permissions.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("usePermissions", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      state: {
        tokens: {
          accessToken: {
            payload: {
              permissions: ["users:read", "users:write"],
              roles: [],
              scope: [],
            },
          },
        },
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

  test("should throw ClientError 401 when token is missing", async () => {
    ctx.state.tokens = {};

    await expect(usePermissions("users:read")(ctx, vi.fn())).rejects.toThrow(ClientError);

    try {
      await usePermissions("users:read")(ctx, vi.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should support custom token key via options", async () => {
    ctx.state.tokens.idToken = {
      payload: {
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
