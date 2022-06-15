import { AuthenticationMethod } from "../../enum";
import { ClientError } from "@lindorm-io/errors";
import { SessionStatus } from "../../common";
import { confirmStrategyController } from "./confirm-strategy";
import { createMockCache } from "@lindorm-io/redis";
import {
  createTestAccount,
  createTestAuthenticationSession,
  createTestStrategySession,
} from "../../fixtures/entity";
import {
  confirmPassword as _confirmPassword,
  resolveAllowedMethods as _resolveAllowedMethods,
} from "../../handler";
import {
  calculateAuthenticationStatus as _calculateAuthenticationStatus,
  calculateLevelOfAssurance as _calculateLevelOfAssurance,
} from "../../util";

jest.mock("../../handler");
jest.mock("../../util");

const calculateAuthenticationStatus = _calculateAuthenticationStatus as jest.Mock;
const calculateLevelOfAssurance = _calculateLevelOfAssurance as jest.Mock;
const confirmPassword = _confirmPassword as jest.Mock;
const resolveAllowedMethods = _resolveAllowedMethods as jest.Mock;

describe("confirmStrategyController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
        strategySessionCache: createMockCache(createTestStrategySession),
      },
      data: {
        challengeConfirmationToken: "jwt.jwt.jwt",
        code: "code",
        otp: "otp",
        password: "password",
        remember: true,
        totp: "totp",
      },
      entity: {
        authenticationSession: createTestAuthenticationSession({
          identityId: null,
          confirmedIdentifiers: ["test@lindorm.io"],
          status: SessionStatus.PENDING,
        }),
        strategySession: createTestStrategySession({
          email: null,
          nin: null,
          phoneNumber: null,
          username: "username",
          status: SessionStatus.PENDING,
          method: AuthenticationMethod.PASSWORD,
        }),
      },
    };

    calculateAuthenticationStatus.mockImplementation(() => SessionStatus.CONFIRMED);
    calculateLevelOfAssurance.mockImplementation(() => 3);
    confirmPassword.mockImplementation(async () =>
      createTestAccount({
        id: "c9cfca6e-c4f5-43b1-b42f-050900e50d60",
      }),
    );
    resolveAllowedMethods.mockResolvedValue([AuthenticationMethod.DEVICE_CHALLENGE]);
  });

  test("should resolve", async () => {
    await expect(confirmStrategyController(ctx)).resolves.toBeUndefined();

    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMethods: ["device_challenge"],
        confirmedIdentifiers: ["test@lindorm.io", "username"],
        confirmedLevelOfAssurance: 3,
        confirmedMethods: ["password"],
        identityId: "c9cfca6e-c4f5-43b1-b42f-050900e50d60",
        remember: true,
        status: "confirmed",
      }),
    );

    expect(ctx.cache.strategySessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "confirmed",
      }),
    );
  });

  test("should resolve with verified identityId", async () => {
    ctx.entity.authenticationSession.identityId = "c9cfca6e-c4f5-43b1-b42f-050900e50d60";

    await expect(confirmStrategyController(ctx)).resolves.toBeUndefined();
  });

  test("should throw on invalid identityId", async () => {
    ctx.entity.authenticationSession.identityId = "bc912b28-42de-4e96-bf1a-0c251df6b844";

    await expect(confirmStrategyController(ctx)).rejects.toThrow(ClientError);
  });
});
