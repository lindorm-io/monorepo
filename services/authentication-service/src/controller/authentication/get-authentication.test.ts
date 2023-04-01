import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { generateClientConfig as _generateClientConfig } from "../../util";
import { getAuthenticationController } from "./get-authentication";
import { SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";

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

  test("should resolve with code status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CODE;

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: [],
        emailHint: null,
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        oidcProviders: [],
        phoneHint: null,
        status: "code",
      },
    });
  });

  test("should resolve with confirmed status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CONFIRMED;

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: [],
        emailHint: null,
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        oidcProviders: [],
        phoneHint: null,
        status: "confirmed",
      },
    });
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.REJECTED;

    await expect(getAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
