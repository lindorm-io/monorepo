import { ClientError } from "@lindorm/errors";
import { createLogoutCallbackHandler } from "./logout-callback-handler";
import { beforeEach, describe, expect, test, vi } from "vitest";

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
        get: vi.fn().mockResolvedValue({
          redirectUri: "https://example.com",
          state: "state",
        }),
        set: vi.fn(),
        del: vi.fn(),
      },
      data: {
        state: "state",
      },
      redirect: vi.fn(),
      session: {
        get: vi.fn(),
        set: vi.fn(),
        del: vi.fn(),
      },
    };
  });

  test("should resolve", async () => {
    await expect(
      createLogoutCallbackHandler(config)(ctx, vi.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.cookies.del).toHaveBeenCalled();
    expect(ctx.session.del).toHaveBeenCalled();
    expect(ctx.redirect).toHaveBeenCalledWith("https://example.com");
  });

  test("should throw on missing cookie", async () => {
    ctx.cookies.get.mockResolvedValueOnce(null);

    await expect(createLogoutCallbackHandler(config)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid state", async () => {
    ctx.data.state = "invalid_state";

    await expect(createLogoutCallbackHandler(config)(ctx, vi.fn())).rejects.toThrow(
      ClientError,
    );
  });
});
