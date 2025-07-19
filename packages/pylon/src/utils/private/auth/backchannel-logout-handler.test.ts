import { ClientError } from "@lindorm/errors";
import { backchannelLogoutHandler } from "./backchannel-logout-handler";

describe("backchannelLogoutHandler", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      aegis: {
        jwt: {
          verify: jest.fn().mockResolvedValue({
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
        logout: jest.fn(),
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
    await expect(backchannelLogoutHandler(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.body).toBeUndefined();
    expect(ctx.status).toBe(204);
  });

  test("should throw on invalid backchannel logout token", async () => {
    ctx.aegis.jwt.verify = jest.fn().mockResolvedValue({
      payload: {
        claims: {
          events: {},
        },
      },
    });

    await expect(backchannelLogoutHandler(ctx, jest.fn())).rejects.toThrow(ClientError);
  });
});
