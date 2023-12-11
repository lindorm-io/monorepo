import { axiosBearerAuthMiddleware as _axiosBearerAuthMiddleware } from "@lindorm-io/axios";
import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
} from "@lindorm-io/common-enums";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { createTestBackchannelSession, createTestClient } from "../../fixtures/entity";
import { generateServerCredentialsJwt as _generateServerCredentialsJwt } from "../../handler";
import { extractAcrValues as _extractAcrValues } from "../../util";
import { oauthBackchannelController } from "./backchannel";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("@lindorm-io/axios");
jest.mock("../../handler");
jest.mock("../../util");

const axiosBearerAuthMiddleware = _axiosBearerAuthMiddleware as jest.Mock;
const extractAcrValues = _extractAcrValues as jest.Mock;
const generateServerCredentialsJwt = _generateServerCredentialsJwt as jest.Mock;

describe("oauthBackchannelController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      axios: {
        authenticationClient: {
          get: jest.fn(),
        },
      },
      data: {
        acrValues: "acrValues",
        bindingMessage: "bindingMessage",
        clientNotificationToken: "client-notification.jwt.jwt",
        loginHint: "test@lindorm.io",
        loginHintToken: "login-hint.jwt.jwt",
        requestedExpiry: 3600,
        scope: "openid offline_access",
        userCode: "userCode",
      },
      entity: {
        client: createTestClient({
          id: "60da4990-23f3-49ac-bcf6-ec7f8aee2ce2",
        }),
      },
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
      token: {
        idToken: {
          claims: {
            email: "test@lindorm.io",
            phoneNumber: "+46705498721",
            username: "identity_username",
          },
          metadata: {
            audiences: [
              "3bfc20bd-0f18-4717-b535-ffb4a071deba",
              "090fd104-7be0-41d1-b877-1c0851318492",
            ],
            nonce: "d821cde6250f4918",
          },
          subject: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
          token: "id.jwt.jwt",
        },
      },
    };

    axiosBearerAuthMiddleware.mockReturnValue("axiosBearerAuthMiddleware");
    extractAcrValues.mockReturnValue({
      factors: [AuthenticationFactor.PHISHING_RESISTANT],
      levelOfAssurance: 3,
      methods: [AuthenticationMethod.TIME_BASED_OTP],
      strategies: [AuthenticationStrategy.TIME_BASED_OTP],
    });
    generateServerCredentialsJwt.mockReturnValue("generateServerCredentialsJwt");
  });

  test("should resolve for all values", async () => {
    await expect(oauthBackchannelController(ctx)).resolves.toStrictEqual({
      body: {
        authReqId: expect.any(String),
        expiresIn: 1800,
        interval: 500,
      },
    });

    expect(ctx.redis.backchannelSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingMessage: "bindingMessage",
        clientId: "60da4990-23f3-49ac-bcf6-ec7f8aee2ce2",
        clientNotificationToken: "client-notification.jwt.jwt",
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          factors: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          singleSignOn: false,
          strategies: [],
        },
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: "id.jwt.jwt",
        loginHint: "test@lindorm.io",
        loginHintToken: "login-hint.jwt.jwt",
        requestedConsent: {
          audiences: expect.arrayContaining([
            "090fd104-7be0-41d1-b877-1c0851318492",
            "3bfc20bd-0f18-4717-b535-ffb4a071deba",
            "60da4990-23f3-49ac-bcf6-ec7f8aee2ce2",
          ]),
          scopes: ["openid", "offline_access"],
        },
        requestedExpiry: 3600,
        requestedLogin: {
          factors: ["urn:lindorm:auth:acr:phr"],
          identityId: "9c0eb0e6-989a-4bcb-a9a6-bc819c6ee3e9",
          levelOfAssurance: 3,
          methods: ["urn:lindorm:auth:method:totp"],
          minimumLevelOfAssurance: 3,
          strategies: ["urn:lindorm:auth:strategy:time-based-otp"],
        },
        status: {
          consent: "pending",
          login: "pending",
        },
        userCode: "userCode",
      }),
    );
  });

  test("should resolve for minimum values", async () => {
    ctx.data = { scope: "openid" };
    ctx.token.idToken = null;

    extractAcrValues.mockReturnValue({
      factors: [],
      levelOfAssurance: 0,
      methods: [],
      strategies: [],
    });

    await expect(oauthBackchannelController(ctx)).resolves.toStrictEqual({
      body: {
        authReqId: expect.any(String),
        expiresIn: 1800,
        interval: 500,
      },
    });

    expect(ctx.redis.backchannelSessionCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        bindingMessage: null,
        clientId: "60da4990-23f3-49ac-bcf6-ec7f8aee2ce2",
        clientNotificationToken: null,
        confirmedConsent: {
          audiences: [],
          scopes: [],
        },
        confirmedLogin: {
          factors: [],
          identityId: null,
          latestAuthentication: null,
          levelOfAssurance: 0,
          metadata: {},
          methods: [],
          remember: false,
          singleSignOn: false,
          strategies: [],
        },
        expires: new Date("2021-01-01T08:30:00.000Z"),
        idTokenHint: null,
        loginHint: null,
        loginHintToken: null,
        requestedConsent: {
          audiences: expect.arrayContaining(["60da4990-23f3-49ac-bcf6-ec7f8aee2ce2"]),
          scopes: ["openid"],
        },
        requestedExpiry: 0,
        requestedLogin: {
          factors: [],
          identityId: null,
          levelOfAssurance: 0,
          methods: [],
          minimumLevelOfAssurance: 3,
          strategies: [],
        },
        status: {
          consent: "pending",
          login: "pending",
        },
        userCode: null,
      }),
    );
  });
});
