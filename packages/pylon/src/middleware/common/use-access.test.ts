import { ClientError } from "@lindorm/errors";
import { useAccess } from "./use-access";

describe("useAccess", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      state: {
        tokens: {
          accessToken: {
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

  test("should call next when all checks pass", async () => {
    const next = jest.fn();

    await expect(
      useAccess({
        roles: ["user"],
        permissions: ["users:read"],
        scopes: ["openid"],
        levelOfAssurance: 2,
        adjustedAccessLevel: 1,
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw 403 when roles check fails", async () => {
    await expect(
      useAccess({ roles: ["admin", "superadmin"] })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);

    try {
      await useAccess({ roles: ["admin", "superadmin"] })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when permissions check fails", async () => {
    await expect(
      useAccess({ permissions: ["users:read", "users:delete"] })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);

    try {
      await useAccess({ permissions: ["users:read", "users:delete"] })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when scopes check fails", async () => {
    await expect(
      useAccess({ scopes: ["admin:all", "system:write"] })(ctx, jest.fn()),
    ).rejects.toThrow(ClientError);

    try {
      await useAccess({ scopes: ["admin:all", "system:write"] })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when levelOfAssurance is too low", async () => {
    await expect(useAccess({ levelOfAssurance: 3 })(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useAccess({ levelOfAssurance: 3 })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when levelOfAssurance is undefined on payload", async () => {
    ctx.state.tokens.accessToken.payload.levelOfAssurance = undefined;

    await expect(useAccess({ levelOfAssurance: 1 })(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useAccess({ levelOfAssurance: 1 })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when adjustedAccessLevel is too low", async () => {
    await expect(useAccess({ adjustedAccessLevel: 5 })(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useAccess({ adjustedAccessLevel: 5 })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 403 when adjustedAccessLevel is undefined on payload", async () => {
    ctx.state.tokens.accessToken.payload.adjustedAccessLevel = undefined;

    await expect(useAccess({ adjustedAccessLevel: 1 })(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useAccess({ adjustedAccessLevel: 1 })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw 401 when token is missing", async () => {
    ctx.state.tokens = {};

    await expect(useAccess({ roles: ["user"] })(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useAccess({ roles: ["user"] })(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should collect all violations into a single error message", async () => {
    try {
      await useAccess({
        roles: ["admin"],
        permissions: ["admin:write"],
        scopes: ["admin:all"],
        levelOfAssurance: 4,
        adjustedAccessLevel: 3,
      })(ctx, jest.fn());
      fail("Expected error to be thrown");
    } catch (err: any) {
      expect(err).toBeInstanceOf(ClientError);
      expect(err.status).toBe(403);
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should support custom token key", async () => {
    ctx.state.tokens.idToken = {
      payload: {
        roles: ["viewer"],
        permissions: ["profile:read"],
        scope: ["openid"],
        levelOfAssurance: 3,
        adjustedAccessLevel: 2,
      },
    };

    const next = jest.fn();

    await expect(
      useAccess({
        roles: ["viewer"],
        permissions: ["profile:read"],
        token: "idToken",
      })(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });
});
