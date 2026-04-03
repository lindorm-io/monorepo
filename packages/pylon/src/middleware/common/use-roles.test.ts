import { ClientError } from "@lindorm/errors";
import { useRoles } from "./use-roles";

describe("useRoles", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      state: {
        tokens: {
          accessToken: {
            payload: {
              permissions: [],
              roles: ["admin", "user"],
              scope: [],
            },
          },
        },
      },
    };
  });

  test("should call next when at least one role matches (OR logic)", async () => {
    const next = jest.fn();

    await expect(useRoles("user", "superadmin")(ctx, next)).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw ClientError 403 when no role matches", async () => {
    await expect(useRoles("superadmin", "moderator")(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );

    try {
      await useRoles("superadmin", "moderator")(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(403);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should throw ClientError 401 when token is missing", async () => {
    ctx.state.tokens = {};

    await expect(useRoles("admin")(ctx, jest.fn())).rejects.toThrow(ClientError);

    try {
      await useRoles("admin")(ctx, jest.fn());
    } catch (err: any) {
      expect(err.status).toBe(401);
      expect(err.message).toMatchSnapshot();
      expect(err.details).toMatchSnapshot();
    }
  });

  test("should support custom token key", async () => {
    ctx.state.tokens.idToken = {
      payload: {
        permissions: [],
        roles: ["viewer"],
        scope: [],
      },
    };

    const next = jest.fn();

    await expect(
      useRoles("viewer", { token: "idToken" })(ctx, next),
    ).resolves.toBeUndefined();

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should throw at factory time if no roles are provided", () => {
    expect(() => useRoles()).toThrow(Error);
    expect(() => useRoles()).toThrow("useRoles requires at least one role");
  });

  test("should throw at factory time if only options are provided", () => {
    expect(() => useRoles({ token: "idToken" })).toThrow(Error);
  });
});
