import { ClientError } from "@lindorm-io/errors";
import { LogoutSessionType } from "../../enum";
import { SessionStatus } from "../../common";
import { getTestLogoutSession } from "../../test/entity";
import { oauthVerifyLogoutController } from "./verify-logout";

describe("oauthVerifyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      deleteCookie: jest.fn(),
      data: {
        sessionId: "ba965b10-44b4-4ec0-b276-10ac52f9d43f",
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        logoutSession: getTestLogoutSession({
          id: "ba965b10-44b4-4ec0-b276-10ac52f9d43f",
          status: SessionStatus.CONFIRMED,
          sessionType: LogoutSessionType.REFRESH,
        }),
      },
    };
  });

  test("should resolve redirect uri", async () => {
    const response = await oauthVerifyLogoutController(ctx);

    expect(response.redirect).toStrictEqual(expect.any(URL));
    expect(response.redirect.toString()).toBe(
      "https://test.client.lindorm.io/redirect?state=YuTs0Kaf8UV1I086TptUqz1Yh1PNoJow",
    );

    expect(ctx.deleteCookie).toHaveBeenCalledTimes(1);
  });

  test("should delete browser session cookie", async () => {
    ctx.entity.logoutSession = getTestLogoutSession({
      id: "ba965b10-44b4-4ec0-b276-10ac52f9d43f",
      status: SessionStatus.CONFIRMED,
      sessionType: LogoutSessionType.BROWSER,
    });

    await expect(oauthVerifyLogoutController(ctx)).resolves.toBeTruthy();

    expect(ctx.deleteCookie).toHaveBeenCalledTimes(2);
  });

  test("should resolve redirect to /logout", async () => {
    ctx.entity.logoutSession.status = SessionStatus.PENDING;

    const response = await oauthVerifyLogoutController(ctx);

    expect(response.redirect).toStrictEqual(expect.any(URL));
    expect(response.redirect.toString()).toBe(
      "https://authentication.test.api.lindorm.io/oauth/logout?session_id=ba965b10-44b4-4ec0-b276-10ac52f9d43f",
    );

    expect(ctx.deleteCookie).not.toHaveBeenCalled();
  });

  test("should throw on invalid session id", async () => {
    ctx.data.sessionId = "wrong";

    await expect(oauthVerifyLogoutController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(oauthVerifyLogoutController(ctx)).rejects.toThrow(ClientError);
  });
});
