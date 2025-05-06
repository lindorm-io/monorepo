import { ClientError } from "@lindorm/errors";
import { createLogoutCallbackHandler } from "./logout-callback-handler";

describe("createLoginHandler", () => {
  let config: any;
  let ctx: any;

  beforeEach(() => {
    config = {
      cookies: {
        login: "login_cookie",
        logout: "logout_cookie",
      },
    };

    ctx = {
      cookies: {
        get: jest.fn().mockResolvedValue({
          redirectUri: "https://example.com",
          state: "state",
        }),
        set: jest.fn(),
        del: jest.fn(),
      },
      data: {
        state: "state",
      },
      redirect: jest.fn(),
      session: {
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      createLogoutCallbackHandler(config)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.session.del).toHaveBeenCalled();
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com");
  });

  test("should throw on missing cookie", async () => {
    ctx.cookies.get.mockResolvedValueOnce(null);

    await expect(createLogoutCallbackHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid state", async () => {
    ctx.data.state = "invalid_state";

    await expect(createLogoutCallbackHandler(config)(ctx, jest.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
