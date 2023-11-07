import { SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
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
      confirmedFederationLevel: 0,
      confirmedFederationProvider: null,
      confirmedStrategies: [],
    });

    ctx = {
      axios: {
        federationClient: {
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

    generateClientConfig.mockReturnValue("CLIENT_CONFIG");
  });

  test("should resolve", async () => {
    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: "CLIENT_CONFIG",
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        federationProviders: ["apple", "google", "microsoft"],
        status: "pending",
      },
    });
  });

  test("should resolve without providers", async () => {
    ctx.entity.authenticationSession = createTestAuthenticationSession({
      confirmedFederationLevel: 2,
      confirmedFederationProvider: "apple",
      confirmedStrategies: [],
    });

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: "CLIENT_CONFIG",
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        federationProviders: [],
        status: "pending",
      },
    });
  });

  test("should resolve with code status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CODE;

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: [],
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        federationProviders: [],
        status: "code",
      },
    });
  });

  test("should resolve with confirmed status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.CONFIRMED;

    await expect(getAuthenticationController(ctx)).resolves.toStrictEqual({
      body: {
        config: [],
        expires: "2022-01-01T08:00:00.000Z",
        mode: "oauth",
        federationProviders: [],
        status: "confirmed",
      },
    });
  });

  test("should throw on invalid status", async () => {
    ctx.entity.authenticationSession.status = SessionStatus.REJECTED;

    await expect(getAuthenticationController(ctx)).rejects.toThrow(ClientError);
  });
});
