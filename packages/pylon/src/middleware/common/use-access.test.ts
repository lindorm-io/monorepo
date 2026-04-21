import { ClientError } from "@lindorm/errors";
import { useAccess } from "./use-access";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("useAccess", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      auth: {
        introspect: vi.fn().mockResolvedValue({
          active: true,
          roles: ["user"],
          permissions: ["users:read"],
          scope: ["openid"],
          levelOfAssurance: 2,
          adjustedAccessLevel: 1,
        }),
      },
      state: {
        tokens: {
          accessToken: {
            header: { baseFormat: "JWT" },
            payload: {
              roles: ["user"],
              permissions: ["users:read"],
              scope: ["openid"],
              levelOfAssurance: 2,
              adjustedAccessLevel: 1,
            },
          },
        },
      },
    };
  });

  describe("with ctx.auth (introspection)", () => {
    test("should call next when all checks pass", async () => {
      const next = vi.fn();

      await expect(
        useAccess({
          roles: ["user"],
          permissions: ["users:read"],
          scope: ["openid"],
          levelOfAssurance: 2,
          adjustedAccessLevel: 1,
        })(ctx, next),
      ).resolves.toBeUndefined();

      expect(ctx.auth.introspect).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("should throw 401 when token is not active", async () => {
      ctx.auth.introspect.mockResolvedValue({ active: false });

      await expect(useAccess({ roles: ["user"] })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ roles: ["user"] })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(401);
        expect(err.message).toMatchSnapshot();
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

    test("should throw 403 when levelOfAssurance is undefined on introspection", async () => {
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        roles: ["user"],
        permissions: ["users:read"],
        scope: ["openid"],
        adjustedAccessLevel: 1,
      });

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

    test("should throw 403 when adjustedAccessLevel is too low", async () => {
      await expect(useAccess({ adjustedAccessLevel: 5 })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ adjustedAccessLevel: 5 })(ctx, vi.fn());
      } catch (err: any) {
        expect(err.status).toBe(403);
        expect(err.details).toMatchSnapshot();
      }
    });

    test("should throw 403 when adjustedAccessLevel is undefined on introspection", async () => {
      ctx.auth.introspect.mockResolvedValue({
        active: true,
        roles: ["user"],
        permissions: ["users:read"],
        scope: ["openid"],
        levelOfAssurance: 2,
      });

      await expect(useAccess({ adjustedAccessLevel: 1 })(ctx, vi.fn())).rejects.toThrow(
        ClientError,
      );

      try {
        await useAccess({ adjustedAccessLevel: 1 })(ctx, vi.fn());
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
          adjustedAccessLevel: 3,
        })(ctx, vi.fn());
        fail("Expected error to be thrown");
      } catch (err: any) {
        expect(err).toBeInstanceOf(ClientError);
        expect(err.status).toBe(403);
        expect(err.details).toMatchSnapshot();
      }
    });
  });

  describe("custom token key", () => {
    test("should use token payload directly even when ctx.auth exists", async () => {
      ctx.state.tokens.idToken = {
        header: { baseFormat: "JWT" },
        payload: {
          roles: ["viewer"],
          permissions: ["profile:read"],
          scope: ["openid"],
          levelOfAssurance: 3,
          adjustedAccessLevel: 2,
        },
      };

      const next = vi.fn();

      await expect(
        useAccess({
          roles: ["viewer"],
          permissions: ["profile:read"],
          token: "idToken",
        })(ctx, next),
      ).resolves.toBeUndefined();

      expect(ctx.auth.introspect).not.toHaveBeenCalled();
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
      }
    });
  });
});
