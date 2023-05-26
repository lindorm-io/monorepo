import { OpenIdScope } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import MockDate from "mockdate";
import { Client, ClientSession } from "../../entity";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestClientSession,
} from "../../fixtures/entity";
import { assertCodeChallenge as _assertCodeChallenge } from "../../util";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleAuthorizationCodeGrant } from "./handle-authorization-code-grant";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

jest.mock("../oauth", () => ({
  generateTokenResponse: jest.fn().mockResolvedValue("generateTokenResponse"),
}));

const generateTokenResponse = _generateTokenResponse as jest.Mock;
const assertCodeChallenge = _assertCodeChallenge as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authorizationCodeCache: createMockRedisRepository(createTestAuthorizationCode),
        authorizationSessionCache: createMockRedisRepository(createTestAuthorizationSession),
      },
      data: {
        code: "code",
        codeVerifier: "codeVerifier",
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        client: createTestClient({
          id: "26176fc1-8e86-41f4-a649-9375c3814f47",
        }),
      },
      mongo: {
        browserSessionRepository: createMockMongoRepository(createTestBrowserSession),
        clientSessionRepository: createMockMongoRepository(createTestClientSession),
      },
    };

    generateTokenResponse.mockReturnValue("generateTokenResponse");
  });

  test("should resolve", async () => {
    ctx.redis.authorizationSessionCache.find.mockResolvedValue(
      createTestAuthorizationSession({
        clientSessionId: "f3a194da-1233-4ada-a25f-ffacbc4fc0bf",
        clientId: "26176fc1-8e86-41f4-a649-9375c3814f47",
        requestedConsent: {
          audiences: [randomUUID()],
          scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL, OpenIdScope.OFFLINE_ACCESS],
        },
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(assertCodeChallenge).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalledWith(
      ctx,
      expect.any(Client),
      expect.any(ClientSession),
    );
  });

  test("should throw on missing session", async () => {
    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid client id", async () => {
    ctx.redis.authorizationSessionCache.find.mockResolvedValue(createTestAuthorizationSession());

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (identityId)", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        // @ts-ignore
        identityId: null,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (levelOfAssurance)", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        levelOfAssurance: 0,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (methods)", async () => {
    ctx.mongo.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        methods: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });
});
