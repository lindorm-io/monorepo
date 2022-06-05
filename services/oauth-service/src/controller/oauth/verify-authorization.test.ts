import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { oauthVerifyAuthorizationController } from "./verify-authorization";
import {
  generateCallbackResponse as _generateCallbackResponse,
  setBrowserSessionCookie as _setBrowserSessionCookie,
} from "../../handler";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../fixtures/entity";

jest.mock("../../handler");

const generateCallbackResponse = _generateCallbackResponse as jest.Mock;
const setBrowserSessionCookie = _setBrowserSessionCookie as jest.Mock;

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
        authorizationSession: createTestAuthorizationSession({
          id: "ba965b10-44b4-4ec0-b276-10ac52f9d43f",
          authenticationStatus: SessionStatus.CONFIRMED,
          browserSessionId: "dc91dd1a-e3b0-4103-80a2-62c42071c502",
          consentStatus: SessionStatus.CONFIRMED,
        }),
        browserSession: createTestBrowserSession({
          id: "dc91dd1a-e3b0-4103-80a2-62c42071c502",
        }),
        client: createTestClient(),
        consentSession: createTestConsentSession(),
      },
    };

    generateCallbackResponse.mockResolvedValue({ redirect: "redirect-callback" });
  });

  test("should resolve callback response", async () => {
    await expect(oauthVerifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "redirect-callback",
    });

    expect(setBrowserSessionCookie).toHaveBeenCalled();
    expect(ctx.deleteCookie).toHaveBeenCalled();
  });

  test("should resolve redirect to /login", async () => {
    ctx.entity.authorizationSession.authenticationStatus = SessionStatus.PENDING;

    const response = (await oauthVerifyAuthorizationController(ctx)) as any;

    expect(response.redirect).toStrictEqual(expect.any(URL));
    expect(response.redirect.toString()).toBe(
      "https://authentication.test.lindorm.io/oauth/login?session_id=ba965b10-44b4-4ec0-b276-10ac52f9d43f",
    );

    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should resolve redirect to /consent", async () => {
    ctx.entity.authorizationSession.consentStatus = SessionStatus.PENDING;

    const response = (await oauthVerifyAuthorizationController(ctx)) as any;

    expect(response.redirect).toStrictEqual(expect.any(URL));
    expect(response.redirect.toString()).toBe(
      "https://authentication.test.lindorm.io/oauth/consent?session_id=ba965b10-44b4-4ec0-b276-10ac52f9d43f",
    );

    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should throw on invalid session id", async () => {
    ctx.data.sessionId = "wrong";

    await expect(oauthVerifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(oauthVerifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session id", async () => {
    ctx.entity.authorizationSession.browserSessionId = "wrong";

    await expect(oauthVerifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });
});
