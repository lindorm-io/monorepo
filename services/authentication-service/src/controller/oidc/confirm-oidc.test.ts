import { calculateAuthenticationStatus as _calculateAuthenticationStatus } from "../../util";
import { confirmOidcController } from "./confirm-oidc";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestAccount, createTestAuthenticationSession } from "../../fixtures/entity";
import { resolveAllowedStrategies as _resolveAllowedStrategies } from "../../handler";
import { randomUUID } from "crypto";
import { ClientError } from "@lindorm-io/errors";
import { AuthenticationStrategy, SessionStatus } from "@lindorm-io/common-types";

jest.mock("../../handler");
jest.mock("../../util");

const calculateAuthenticationStatus = _calculateAuthenticationStatus as jest.Mock;
const resolveAllowedStrategies = _resolveAllowedStrategies as jest.Mock;

describe("confirmOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      allowedStrategies: [AuthenticationStrategy.BANK_ID_SE],
      identityId: null,
    });

    ctx = {
      axios: {
        oidcClient: {
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
      cache: {
        authenticationSessionCache: createMockCache(() => authenticationSession),
      },
      data: {
        session: "session",
      },
      repository: {
        accountRepository: createMockRepository(createTestAccount),
      },
    };

    calculateAuthenticationStatus.mockImplementation(() => "pending");
    resolveAllowedStrategies.mockResolvedValue(["strategy"]);
  });

  test("should resolve", async () => {
    await expect(confirmOidcController(ctx)).resolves.toStrictEqual({ redirect: expect.any(URL) });

    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: expect.any(String),
        confirmedOidcLevel: 5,
        confirmedOidcProvider: "provider",
        allowedStrategies: ["strategy"],
        status: "pending",
      }),
    );
  });

  test("should skip resolving strategies when not pending", async () => {
    calculateAuthenticationStatus.mockImplementation(() => "confirmed");

    await expect(confirmOidcController(ctx)).resolves.toStrictEqual({ redirect: expect.any(URL) });

    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalledWith(
      expect.objectContaining({
        identityId: expect.any(String),
        confirmedOidcLevel: 5,
        confirmedOidcProvider: "provider",
        allowedStrategies: ["bank_id_se"],
        status: SessionStatus.CONFIRMED,
      }),
    );
  });

  test("should throw on invalid identityId", async () => {
    ctx.cache.authenticationSessionCache.find.mockResolvedValue(
      createTestAuthenticationSession({
        identityId: randomUUID(),
      }),
    );

    ctx.axios.oidcClient.get.mockResolvedValue({
      data: {
        identityId: randomUUID(),
        levelOfAssurance: 5,
        provider: "provider",
      },
    });

    await expect(confirmOidcController(ctx)).rejects.toThrow(ClientError);
  });
});
