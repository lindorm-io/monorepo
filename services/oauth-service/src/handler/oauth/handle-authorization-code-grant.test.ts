import MockDate from "mockdate";
import { assertCodeChallenge as _assertCodeChallenge } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateTokenResponse as _generateTokenResponse } from "./generate-token-response";
import { handleAuthorizationCodeGrant } from "./handle-authorization-code-grant";
import { randomUUID } from "crypto";
import { ClientError } from "@lindorm-io/errors";
import {
  createTestAuthorizationCode,
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

jest.mock("./generate-token-response", () => ({
  generateTokenResponse: jest.fn().mockResolvedValue("generateTokenResponse"),
}));

const assertCodeChallenge = _assertCodeChallenge as jest.Mock;
const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationCodeCache: createMockCache(createTestAuthorizationCode),
        authorizationSessionCache: createMockCache((opts) =>
          createTestAuthorizationSession({
            clientId: "1fd075a0-eac1-4809-844b-23c4eb8946c2",
            identifiers: {
              browserSessionId: "38183591-069f-495b-83e8-db3b975ad5b7",
              consentSessionId: "48833a69-e11a-4e4e-9cf9-32d808f788c6",
            },
            ...opts,
          }),
        ),
      },
      data: {
        code: "code",
        codeVerifier: "codeVerifier",
        redirectUri: "https://test.client.lindorm.io/redirect",
      },
      entity: {
        client: createTestClient({
          id: "1fd075a0-eac1-4809-844b-23c4eb8946c2",
        }),
      },
      repository: {
        browserSessionRepository: createMockRepository((opts) =>
          createTestBrowserSession({
            id: "38183591-069f-495b-83e8-db3b975ad5b7",
          }),
        ),
        consentSessionRepository: createMockRepository((opts) =>
          createTestConsentSession({
            id: "48833a69-e11a-4e4e-9cf9-32d808f788c6",
            sessions: ["38183591-069f-495b-83e8-db3b975ad5b7"],
          }),
        ),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve refresh session", async () => {
    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(ctx.cache.authorizationCodeCache.find).toHaveBeenCalled();
    expect(ctx.cache.authorizationSessionCache.find).toHaveBeenCalled();
    expect(assertCodeChallenge).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.consentSessionRepository.find).toHaveBeenCalled();
    expect(ctx.cache.authorizationCodeCache.destroy).toHaveBeenCalled();
    expect(ctx.cache.authorizationSessionCache.destroy).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalled();

    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).not.toHaveBeenCalled();
  });

  test("should resolve browser session", async () => {
    ctx.cache.authorizationSessionCache.find.mockResolvedValue(
      createTestAuthorizationSession({
        clientId: "1fd075a0-eac1-4809-844b-23c4eb8946c2",
        identifiers: {
          browserSessionId: "38183591-069f-495b-83e8-db3b975ad5b7",
          consentSessionId: "48833a69-e11a-4e4e-9cf9-32d808f788c6",
          refreshSessionId: null,
        },
        requestedConsent: {
          audiences: [randomUUID()],
          scopes: ["openid", "email"],
        },
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("generateTokenResponse");

    expect(ctx.repository.consentSessionRepository.update).not.toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalled();
  });

  test("should throw on invalid client id", async () => {
    ctx.entity.client = createTestClient();

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (acrValues)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "38183591-069f-495b-83e8-db3b975ad5b7",
        acrValues: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (amrValues)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "38183591-069f-495b-83e8-db3b975ad5b7",
        amrValues: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (identityId)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "38183591-069f-495b-83e8-db3b975ad5b7",
        // @ts-ignore
        identityId: null,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid browser session (levelOfAssurance)", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        id: "38183591-069f-495b-83e8-db3b975ad5b7",
        levelOfAssurance: 0,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid consent session (audiences)", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      createTestConsentSession({
        audiences: [],
        sessions: ["38183591-069f-495b-83e8-db3b975ad5b7"],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid consent session (scopes)", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      createTestConsentSession({
        scopes: [],
        sessions: ["38183591-069f-495b-83e8-db3b975ad5b7"],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid consent session (sessions)", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      createTestConsentSession({
        sessions: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });
});
