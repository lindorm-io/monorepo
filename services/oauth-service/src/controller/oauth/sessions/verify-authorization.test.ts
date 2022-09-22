import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../../common";
import { verifyAuthorizationController } from "./verify-authorization";
import { createMockCache } from "@lindorm-io/redis";
import {
  generateCallbackResponse as _generateCallbackResponse,
  getUpdatedBrowserSession as _getUpdatedBrowserSession,
  getUpdatedConsentSession as _getUpdatedConsentSession,
  setBrowserSessionCookie as _setBrowserSessionCookie,
} from "../../../handler";
import {
  createConsentPendingUri as _createConsentPendingUri,
  createConsentRejectedUri as _createConsentRejectedUri,
  createLoginPendingUri as _createLoginPendingUri,
  createLoginRejectedUri as _createLoginRejectedUri,
} from "../../../util";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
} from "../../../fixtures/entity";

jest.mock("../../../handler");
jest.mock("../../../util");

const generateCallbackResponse = _generateCallbackResponse as jest.Mock;
const getUpdatedBrowserSession = _getUpdatedBrowserSession as jest.Mock;
const getUpdatedConsentSession = _getUpdatedConsentSession as jest.Mock;
const setBrowserSessionCookie = _setBrowserSessionCookie as jest.Mock;
const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createConsentRejectedUri = _createConsentRejectedUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createLoginRejectedUri = _createLoginRejectedUri as jest.Mock;

describe("oauthVerifyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      data: {
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        authorizationSession: createTestAuthorizationSession({
          id: "a49cce82-d0e4-413b-9098-f63d7f5e89e8",
          status: {
            consent: SessionStatus.CONFIRMED,
            login: SessionStatus.CONFIRMED,
          },
        }),
        client: createTestClient(),
      },
      metadata: {
        environment: "development",
      },
      cookies: {
        get: jest.fn().mockImplementation(() => "a49cce82-d0e4-413b-9098-f63d7f5e89e8"),
      },
    };

    generateCallbackResponse.mockResolvedValue({ redirect: "generateCallbackResponse" });
    getUpdatedBrowserSession.mockImplementation(() => createTestBrowserSession());
    getUpdatedConsentSession.mockImplementation(() => createTestConsentSession());
    setBrowserSessionCookie.mockImplementation();
    createConsentPendingUri.mockImplementation(() => "createConsentPendingUri");
    createConsentRejectedUri.mockImplementation(() => "createConsentRejectedUri");
    createLoginPendingUri.mockImplementation(() => "createLoginPendingUri");
    createLoginRejectedUri.mockImplementation(() => "createLoginRejectedUri");
  });

  afterEach(jest.clearAllMocks);

  test("should resolve callback response", async () => {
    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "generateCallbackResponse",
    });

    expect(generateCallbackResponse).toHaveBeenCalled();
    expect(getUpdatedBrowserSession).toHaveBeenCalled();
    expect(getUpdatedConsentSession).toHaveBeenCalled();
    expect(setBrowserSessionCookie).toHaveBeenCalled();
  });

  test("should resolve pending login redirect", async () => {
    ctx.entity.authorizationSession.status.login = SessionStatus.PENDING;

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginPendingUri",
    });
  });

  test("should resolve rejected login redirect", async () => {
    ctx.entity.authorizationSession.status.login = SessionStatus.REJECTED;

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginRejectedUri",
    });
  });

  test("should resolve pending consent redirect", async () => {
    ctx.entity.authorizationSession.status.consent = SessionStatus.PENDING;

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentPendingUri",
    });
  });

  test("should resolve rejected consent redirect", async () => {
    ctx.entity.authorizationSession.status.consent = SessionStatus.REJECTED;

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentRejectedUri",
    });
  });

  test("should throw on invalid cookie id", async () => {
    ctx.cookies.get.mockImplementation(() => "wrong");

    await expect(verifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(verifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });
});
