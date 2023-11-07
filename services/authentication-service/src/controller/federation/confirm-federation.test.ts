import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-types";
import { ClientError } from "@lindorm-io/errors";
import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { randomUUID } from "crypto";
import { createTestAccount, createTestAuthenticationSession } from "../../fixtures/entity";
import { resolveAllowedStrategies as _resolveAllowedStrategies } from "../../handler";
import { calculateAuthenticationStatus as _calculateAuthenticationStatus } from "../../util";
import { confirmFederationController } from "./confirm-federation";

jest.mock("../../handler");
jest.mock("../../util");

const calculateAuthenticationStatus = _calculateAuthenticationStatus as jest.Mock;
const resolveAllowedStrategies = _resolveAllowedStrategies as jest.Mock;

describe("confirmFederationController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      allowedStrategies: [AuthenticationStrategy.BANK_ID_SE],
      identityId: null,
    });

    ctx = {
      axios: {
        federationClient: {
          get: jest.fn().mockResolvedValue({
            data: {
              callbackId: authenticationSession.id,
              identityId: authenticationSession.identityId,
              levelOfAssurance: 5,
              provider: "provider",
            },
          }),
        },
      },
      redis: {
        authenticationSessionCache: createMockRedisRepository(() => authenticationSession),
      },
      data: {
        session: "session",
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    calculateAuthenticationStatus.mockReturnValue("pending");
    resolveAllowedStrategies.mockResolvedValue(["strategy"]);
  });

  test("should resolve", async () => {
    await expect(confirmFederationController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: expect.any(String),
        confirmedFederationLevel: 5,
        confirmedFederationProvider: "provider",
        allowedStrategies: ["strategy"],
        status: "pending",
      }),
    );
  });

  test("should skip resolving strategies when not pending", async () => {
    calculateAuthenticationStatus.mockReturnValue("confirmed");

    await expect(confirmFederationController(ctx)).resolves.toStrictEqual({
      redirect: expect.any(URL),
    });

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: expect.any(String),
        confirmedFederationLevel: 5,
        confirmedFederationProvider: "provider",
        allowedStrategies: ["bank_id_se"],
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should throw on invalid identityId", async () => {
    ctx.redis.authenticationSessionCache.find.mockResolvedValue(
      createTestAuthenticationSession({
        identityId: randomUUID(),
      }),
    );

    ctx.axios.federationClient.get.mockResolvedValue({
      data: {
        identityId: randomUUID(),
        levelOfAssurance: 5,
        provider: "provider",
      },
    });

    await expect(confirmFederationController(ctx)).rejects.toThrow(ClientError);
  });
});
