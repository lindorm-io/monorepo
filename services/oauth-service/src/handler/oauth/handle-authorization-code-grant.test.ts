import MockDate from "mockdate";
import { ClientError } from "@lindorm-io/errors";
import { Scope } from "../../common";
import { assertCodeChallenge as _assertCodeChallenge } from "../../util";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { generateTokenResponse as _generateTokenResponse } from "./generate-token-response";
import { handleAuthorizationCodeGrant } from "./handle-authorization-code-grant";
import {
  createTestAuthorizationSession,
  createTestBrowserSession,
  createTestClient,
  createTestConsentSession,
  createTestRefreshSession,
} from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("../../util");

jest.mock("./generate-token-response", () => ({
  generateTokenResponse: jest.fn().mockResolvedValue("body-response"),
}));

const assertCodeChallenge = _assertCodeChallenge as jest.Mock;
const generateTokenResponse = _generateTokenResponse as jest.Mock;

describe("handleAuthorizationCodeGrant", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authorizationSessionCache: createMockCache((options) =>
          createTestAuthorizationSession({
            browserSessionId: "36b51c4b-b13d-4a58-81fd-ce8c09a9b362",
            clientId: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
            consentSessionId: "6bf190fd-cecd-406d-ba6d-4dd658312ed6",
            redirectUri: "https://test.client.lindorm.io/redirect",
            scopes: [Scope.OPENID],
            ...options,
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
          id: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
        }),
      },
      repository: {
        browserSessionRepository: createMockRepository(createTestBrowserSession),
        consentSessionRepository: createMockRepository((options) =>
          createTestConsentSession({
            sessions: ["36b51c4b-b13d-4a58-81fd-ce8c09a9b362"],
            ...options,
          }),
        ),
        refreshSessionRepository: createMockRepository(createTestRefreshSession),
      },
    };
  });

  test("should resolve", async () => {
    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("body-response");

    expect(ctx.cache.authorizationSessionCache.find).toHaveBeenCalled();
    expect(assertCodeChallenge).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.find).toHaveBeenCalled();
    expect(ctx.repository.consentSessionRepository.find).toHaveBeenCalled();
    expect(ctx.cache.authorizationSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.repository.browserSessionRepository.update).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should resolve with refresh session", async () => {
    ctx.cache.authorizationSessionCache.find.mockResolvedValue(
      createTestAuthorizationSession({
        browserSessionId: "36b51c4b-b13d-4a58-81fd-ce8c09a9b362",
        clientId: "08bac8f5-af23-43a9-bb43-cda6cc2ec2c6",
        consentSessionId: "6bf190fd-cecd-406d-ba6d-4dd658312ed6",
        redirectUri: "https://test.client.lindorm.io/redirect",
        scopes: [Scope.OFFLINE_ACCESS],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).resolves.toBe("body-response");

    expect(ctx.cache.authorizationSessionCache.find).toHaveBeenCalled();
    expect(assertCodeChallenge).toHaveBeenCalled();
    expect(ctx.repository.consentSessionRepository.find).toHaveBeenCalled();
    expect(ctx.cache.authorizationSessionCache.destroy).toHaveBeenCalled();
    expect(ctx.repository.refreshSessionRepository.create).toHaveBeenCalled();
    expect(ctx.repository.consentSessionRepository.update).toHaveBeenCalled();
    expect(generateTokenResponse).toHaveBeenCalled();
  });

  test("should throw on invalid client id", async () => {
    ctx.entity.client = createTestClient({
      id: "70d3cd6b-0bd1-424c-8bf4-59f94d5876c5",
    });

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid redirect uri", async () => {
    ctx.data.redirectUri = "wrong";

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid authentication", async () => {
    ctx.repository.browserSessionRepository.find.mockResolvedValue(
      createTestBrowserSession({
        identityId: null,
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid consent", async () => {
    ctx.repository.consentSessionRepository.find.mockResolvedValue(
      createTestAuthorizationSession({
        audiences: [],
      }),
    );

    await expect(handleAuthorizationCodeGrant(ctx)).rejects.toThrow(ClientError);
  });
});
