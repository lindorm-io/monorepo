import {
  AuthenticationMethod,
  AuthenticationStrategy,
  IdentifierType,
  SessionStatus,
} from "@lindorm-io/common-enums";
import { ClientError } from "@lindorm-io/errors";
import { createMockRedisRepository } from "@lindorm-io/redis";
import {
  createTestAccount,
  createTestAuthenticationSession,
  createTestStrategySession,
} from "../../fixtures/entity";
import { resolveAllowedStrategies as _resolveAllowedMethods } from "../../handler";
import { getStrategyHandler as _getStrategyHandler } from "../../strategies";
import { calculateAuthenticationStatus as _calculateAuthenticationStatus } from "../../util";
import { confirmStrategyController } from "./confirm-strategy";

jest.mock("../../handler");
jest.mock("../../strategies");
jest.mock("../../util");

const calculateAuthenticationStatus = _calculateAuthenticationStatus as jest.Mock;
const getStrategyHandler = _getStrategyHandler as jest.Mock;
const resolveAllowedMethods = _resolveAllowedMethods as jest.Mock;

describe("confirmStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
        strategySessionCache: createMockRedisRepository(createTestStrategySession),
      },
      data: {
        challengeConfirmationToken: "jwt.jwt.jwt",
        code: "code",
        otp: "otp",
        password: "password",
        token: "password",
        totp: "totp",

        remember: true,
        sso: true,
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          allowedStrategies: [AuthenticationStrategy.DEVICE_CHALLENGE],
          identityId: null,
          confirmedIdentifiers: ["test@lindorm.io"],
          requiredLevelOfAssurance: 1,
          status: SessionStatus.PENDING,
        }),
        strategySession: createTestStrategySession({
          id: "0e8f3c0d-264f-45e2-8d95-9e4dbb18063e",
          identifier: "username",
          identifierType: IdentifierType.USERNAME,
          status: SessionStatus.PENDING,
          strategy: AuthenticationStrategy.PASSWORD,
        }),
      },
      token: {
        strategySessionToken: {
          metadata: { session: "0e8f3c0d-264f-45e2-8d95-9e4dbb18063e" },
        },
      },
    };

    getStrategyHandler.mockImplementation(() => ({
      confirm: async () =>
        createTestAccount({
          id: "c9cfca6e-c4f5-43b1-b42f-050900e50d60",
        }),
    }));
    calculateAuthenticationStatus.mockReturnValue("confirmed");
    resolveAllowedMethods.mockResolvedValue([AuthenticationMethod.DEVICE_LINK]);
  });

  test("should resolve", async () => {
    await expect(confirmStrategyController(ctx)).resolves.toBeUndefined();

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedStrategies: ["urn:lindorm:auth:strategy:device-challenge"],
        confirmedIdentifiers: ["test@lindorm.io", "username"],
        confirmedStrategies: ["urn:lindorm:auth:strategy:password"],
        identityId: "c9cfca6e-c4f5-43b1-b42f-050900e50d60",
        remember: true,
        status: SessionStatus.CONFIRMED,
      }),
    );

    expect(ctx.redis.strategySessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should resolve with verified identityId", async () => {
    ctx.entity.authenticationSession.identityId = "c9cfca6e-c4f5-43b1-b42f-050900e50d60";

    await expect(confirmStrategyController(ctx)).resolves.toBeUndefined();
  });

  test("should throw on invalid session", async () => {
    ctx.token.strategySessionToken.metadata.session = "wrong";

    await expect(confirmStrategyController(ctx)).rejects.toThrow(ClientError);
  });

  test("should throw on invalid identityId", async () => {
    ctx.entity.authenticationSession.identityId = "bc912b28-42de-4e96-bf1a-0c251df6b844";

    await expect(confirmStrategyController(ctx)).rejects.toThrow(ClientError);
  });
});
