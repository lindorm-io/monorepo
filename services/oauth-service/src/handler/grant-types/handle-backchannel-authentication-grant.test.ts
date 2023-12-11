import {
  AuthenticationFactor,
  AuthenticationMethod,
  AuthenticationStrategy,
  Scope,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import {
  createTestBackchannelSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleBackchannelAuthenticationGrant } from "./handle-backchannel-authentication-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../oauth");

const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleBackchannelAuthenticationGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        authReqId: "ac423985-7ce7-5052-aa92-2f98c3308f66",
      },
      entity: {
        client: createTestClient({
          id: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
          tenantId: "8039186b-9006-4f35-a764-cabdf1471290",
        }),
      },
      mongo: {
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
      redis: {
        backchannelSessionCache: createMockRedisRepository(createTestBackchannelSession),
      },
    };

    generateTokenResponse.mockReturnValue("generateTokenResponse");
  });

  test("should resolve", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        clientSessionId: "50e46ed2-f10f-53be-8c4c-3170f4a66cb0",
        confirmedConsent: {
          audiences: ["85c5c825-a762-518c-9eec-4ab2a7355601"],
          scopes: [Scope.OPENID, Scope.OFFLINE_ACCESS],
        },
        confirmedLogin: {
          factors: [AuthenticationFactor.ONE_FACTOR],
          identityId: "69d76427-1e6c-5915-b4c0-08fd6bb0b14f",
          latestAuthentication: new Date(),
          levelOfAssurance: 3,
          metadata: {},
          methods: [AuthenticationMethod.PASSWORD],
          remember: true,
          singleSignOn: true,
          strategies: [AuthenticationStrategy.PASSWORD_BROWSER_LINK],
        },
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).resolves.toStrictEqual(
      "generateTokenResponse",
    );

    expect(ctx.mongo.clientSessionRepository.find).toHaveBeenCalled();
  });

  test("should throw on invalid client id", async () => {
    ctx.entity.client = createTestClient();

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow("Invalid Request");
  });

  test("should throw on pending consent status", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        status: {
          consent: SessionStatus.PENDING,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow(
      "Authorization Pending",
    );
  });

  test("should throw on pending login status", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.PENDING,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow(
      "Authorization Pending",
    );
  });

  test("should throw on rejected consent status", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        status: {
          consent: SessionStatus.REJECTED,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow("Access Denied");
  });

  test("should throw on rejected login status", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        status: {
          consent: SessionStatus.CONFIRMED,
          login: SessionStatus.REJECTED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow("Access Denied");
  });

  test("should throw on unexpected status", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        status: {
          consent: SessionStatus.ACKNOWLEDGED,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow(
      "Unexpected session status",
    );
  });

  test("should throw on missing client session id", async () => {
    ctx.redis.backchannelSessionCache.find.mockResolvedValue(
      createTestBackchannelSession({
        clientId: "93a3e439-12be-582d-ae8f-5cb7e1ab3ebd",
        clientSessionId: null,
        status: {
          consent: SessionStatus.ACKNOWLEDGED,
          login: SessionStatus.CONFIRMED,
        },
      }),
    );

    await expect(handleBackchannelAuthenticationGrant(ctx)).rejects.toThrow(
      "Unexpected session status",
    );
  });
});
