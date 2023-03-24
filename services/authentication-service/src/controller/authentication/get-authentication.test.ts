import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { generateClientConfig as _generateClientConfig } from "../../util";
import { getAuthenticationController } from "./get-authentication";

jest.mock("../../util");

const generateClientConfig = _generateClientConfig as jest.Mock;

describe("getAuthenticationController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      confirmedOidcLevel: 0,
      confirmedOidcProvider: null,
      confirmedStrategies: [],
    });

    ctx = {
      axios: {
        oidcClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              providers: ["apple", "google", "microsoft"],
            },
          }),
        },
      },
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      entity: {
        authenticationSession,
      },
    };

    generateClientConfig.mockImplementation(() => "CLIENT_CONFIG");
  });

  test("should resolve", async () => {
    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: "CLIENT_CONFIG",
        emailHint: "test@lindorm.io",
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        oidcProviders: ["apple", "google", "microsoft"],
        phoneHint: "0701234567",
        status: "pending",
      },
    });
  });

  test("should resolve without providers", async () => {
    ctx.entity.authenticationSession = createTestAuthenticationSession({
      confirmedOidcLevel: 2,
      confirmedOidcProvider: "apple",
      confirmedStrategies: [],
    });

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: "CLIENT_CONFIG",
        emailHint: "test@lindorm.io",
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        oidcProviders: [],
        phoneHint: "0701234567",
        status: "pending",
      },
    });
  });

  test("should resolve with code", async () => {
    ctx.entity.authenticationSession.status = "confirmed";

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        code: expect.any(String),
        mode: "oauth",
      },
    });

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        code: expect.any(String),
        status: "code",
      }),
    );
  });
});
