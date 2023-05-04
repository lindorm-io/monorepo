import { SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import {
  createTestAuthorizationSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import {
  generateCallbackResponse as _generateCallbackResponse,
  handleOauthConsentVerification as _handleOauthConsentVerification,
  handleOauthLoginVerification as _handleOauthLoginVerification,
} from "../../handler";
import {
  createConsentPendingUri as _createConsentPendingUri,
  createConsentRejectedUri as _createConsentRejectedUri,
  createLoginPendingUri as _createLoginPendingUri,
  createLoginRejectedUri as _createLoginRejectedUri,
  createSelectAccountPendingUri as _createSelectAccountPendingUri,
  createSelectAccountRejectedUri as _createSelectAccountRejectedUri,
} from "../../util";
import { verifyAuthorizationController } from "./verify-authorization";

jest.mock("../../handler");
jest.mock("../../util");

const createConsentPendingUri = _createConsentPendingUri as jest.Mock;
const createConsentRejectedUri = _createConsentRejectedUri as jest.Mock;
const createLoginPendingUri = _createLoginPendingUri as jest.Mock;
const createLoginRejectedUri = _createLoginRejectedUri as jest.Mock;
const createSelectAccountPendingUri = _createSelectAccountPendingUri as jest.Mock;
const createSelectAccountRejectedUri = _createSelectAccountRejectedUri as jest.Mock;
const generateCallbackResponse = _generateCallbackResponse as jest.Mock;
const handleOauthConsentVerification = _handleOauthConsentVerification as jest.Mock;
const handleOauthLoginVerification = _handleOauthLoginVerification as jest.Mock;

describe("oauthVerifyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
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
            selectAccount: SessionStatus.CONFIRMED,
          },
        }),
        client: createTestClient(),
      },
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },

      server: {
        environment: "development",
      },
      cookies: {
        get: jest.fn().mockReturnValue("a49cce82-d0e4-413b-9098-f63d7f5e89e8"),
      },
    };

    handleOauthLoginVerification.mockImplementation((_, session) =>
      createTestAuthorizationSession({
        ...session,
        status: {
          ...session.status,
          login: "verified",
        },
      }),
    );
    handleOauthConsentVerification.mockImplementation((_, session) =>
      createTestAuthorizationSession({
        ...session,
        status: {
          ...session.status,
          consent: "verified",
        },
      }),
    );

    createConsentPendingUri.mockReturnValue("createConsentPendingUri");
    createConsentRejectedUri.mockReturnValue("createConsentRejectedUri");
    createLoginPendingUri.mockReturnValue("createLoginPendingUri");
    createLoginRejectedUri.mockReturnValue("createLoginRejectedUri");
    createSelectAccountPendingUri.mockReturnValue("createSelectAccountPendingUri");
    createSelectAccountRejectedUri.mockReturnValue("createSelectAccountRejectedUri");
    generateCallbackResponse.mockResolvedValue({ redirect: "generateCallbackResponse" });
  });

  afterEach(jest.clearAllMocks);

  test("should resolve callback response", async () => {
    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "generateCallbackResponse",
    });

    expect(generateCallbackResponse).toHaveBeenCalled();
    expect(handleOauthLoginVerification).toHaveBeenCalled();
    expect(handleOauthConsentVerification).toHaveBeenCalled();
  });

  test("should resolve pending selectAccount redirect", async () => {
    ctx.entity.authorizationSession.status.selectAccount = "pending";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createSelectAccountPendingUri",
    });
  });

  test("should resolve rejected selectAccount redirect", async () => {
    ctx.entity.authorizationSession.status.selectAccount = "rejected";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createSelectAccountRejectedUri",
    });
  });

  test("should resolve pending login redirect", async () => {
    ctx.entity.authorizationSession.status.login = "pending";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginPendingUri",
    });
  });

  test("should resolve rejected login redirect", async () => {
    ctx.entity.authorizationSession.status.login = "rejected";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createLoginRejectedUri",
    });
  });

  test("should resolve pending consent redirect", async () => {
    ctx.entity.authorizationSession.status.consent = "pending";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentPendingUri",
    });
  });

  test("should resolve rejected consent redirect", async () => {
    ctx.entity.authorizationSession.status.consent = "rejected";

    await expect(verifyAuthorizationController(ctx)).resolves.toStrictEqual({
      redirect: "createConsentRejectedUri",
    });
  });

  test("should throw on invalid cookie id", async () => {
    ctx.cookies.get.mockReturnValue("wrong");

    await expect(verifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(verifyAuthorizationController(ctx)).rejects.toThrow(ClientError);
  });
});
