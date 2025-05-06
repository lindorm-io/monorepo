import { ClientError } from "@lindorm/errors";
import { createAuthHandler } from "./auth-handler";

describe("createAuthHandler", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      expose: {
        accessToken: true,
        idToken: true,
        scope: true,
        subject: true,
      },
    };

    ctx = {
      state: {
        session: {
          accessToken: "accessToken",
          idToken: "idToken",
          scope: ["scope"],
          subject: "subject",
        },
      },
    };
  });

  test("should resolve exposed session data", async () => {
    await expect(createAuthHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({
      accessToken: "accessToken",
      idToken: "idToken",
      scope: ["scope"],
      subject: "subject",
    });
    expect(ctx.status).toBe(200);
  });

  test("should not resolve when expose is false", async () => {
    config.expose = {};
    await expect(createAuthHandler(config)(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toEqual({});
    expect(ctx.status).toBe(200);
  });

  test("should throw on missing session", async () => {
    ctx.state.session = null;

    await expect(createAuthHandler(config)(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
