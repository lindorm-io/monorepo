import MockDate from "mockdate";
import { AccessSession, Client, RefreshSession } from "../../entity";
import { ClientError } from "@lindorm-io/errors";
import { assertCodeChallenge as _assertCodeChallenge } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateTokenResponse as _generateTokenResponse } from "../oauth";
import { handleAuthorizationCodeGrant } from "./handle-authorization-code-grant";
import { randomUUID } from "crypto";
import {
  createTestAccessSession,
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestRefreshSession,
} from "../../fixtures/entity";
import { OpenIdScope } from "@lindorm-io/common-types";

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
      cache: {
        authorizationCodeCache: createMockCache(createTestAuthorizationCode),
        authorizationSessionCache: createMockCache(createTestAuthorizationSession),
      },
      data: {
        code: "code",
        codeVerifier: "codeVerifier",
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        client: createTestClient(),
      },
      repository: {
        accessSessionRepository: createMockRepository(createTestAccessSession),
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };

    generateTokenResponse.mockImplementation(() => "generateTokenResponse");
  });

  test("should resolve access session", async () => {
    ctx.cache.authorizationSessionCache.find.mockResolvedValue(
      createTestAuthorizationSession({
        clientId: ctx.entity.client.id,
        refreshSessionId: null,
        requestedConsent: {
          audiences: [randomUUID()],
          scopes: [OpenIdScope.OPENID, OpenIdScope.EMAIL],
        },
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(assertCodeChallenge).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalledWith(
      ctx,
      expect.any(Client),
      expect.any(AccessSession),
    );
  });

  test("should resolve refresh session", async () => {
    ctx.cache.authorizationSessionCache.find.mockResolvedValue(
      createTestAuthorizationSession({
        accessSessionId: null,
        clientId: ctx.entity.client.id,
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
      expect.any(RefreshSession),
    );
  });

  test("should throw on missing session", async () => {
    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid client id", async () => {
    ctx.cache.authorizationSessionCache.find.mockResolvedValue(createTestAuthorizationSession());

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (identityId)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        // @ts-ignore
        identityId: null,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (levelOfAssurance)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        levelOfAssurance: 0,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (methods)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        methods: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });
});
