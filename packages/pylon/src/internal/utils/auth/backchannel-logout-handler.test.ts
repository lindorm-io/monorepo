import { ClientError } from "@lindorm/errors";
import { backchannelLogoutHandler } from "./backchannel-logout-handler.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("backchannelLogoutHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      aegis: {
        jwt: {
          verify: vi.fn().mockResolvedValue({
            payload: {
              claims: {
                events: {
                  "http://schemas.openid.net/event/backchannel-logout": {},
                },
              },
              subject: "subject",
            },
          }),
        },
      },
      data: {
        logoutToken: "logoutToken",
      },
      session: {
        logout: vi.fn(),
      },
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

  test("should resolve", async () => {
    await expect(backchannelLogoutHandler(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(204);
  });

  test("should throw on invalid backchannel logout token", async () => {
    ctx.aegis.jwt.verify = vi.fn().mockResolvedValue({
      payload: {
        claims: {
          events: {},
        },
      },
    });

    await expect(backchannelLogoutHandler(ctx, vi.fn())).rejects.toThrow(ClientError);
  });
});
