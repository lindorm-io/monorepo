import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createMockRedisRepository } from "@lindorm-io/redis";
import MockDate from "mockdate";
import { AuthenticationSession } from "../../entity";
import { createTestAccount, createTestAuthenticationSession } from "../../fixtures/entity";
import { handleAuthenticationInitialisation } from "./handle-authentication-initialisation";
import { resolveAllowedStrategies as _resolveAllowedStrategies } from "./resolve-allowed-strategies";

MockDate.set("2021-01-01T08:00:00.000Z");

jest.mock("./resolve-allowed-strategies");

const resolveAllowedStrategies = _resolveAllowedStrategies as jest.Mock;

describe("handleAuthenticationInitialisation", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      mongo: {
        accountRepository: createMockMongoRepository(createTestAccount),
      },
    };

    options = {
      clientId: "5a30f38c-bfcb-4bd3-a76f-6fdce87e7a82",
      country: "se",
      expires: "2022-01-01T08:00:00.000Z",
      identityId: "71781faf-5195-4cd9-8200-5a54b9ddcdc6",
      nonce: "nonce",
      codeChallenge: "codeChallenge",
      codeChallengeMethod: "S256",
      requiredLevel: 4,
      requiredMethods: ["email"],
    };

    resolveAllowedStrategies.mockResolvedValue(["device_challenge"]);
  });

  test("should resolve", async () => {
    await expect(handleAuthenticationInitialisation(ctx, options)).resolves.toStrictEqual(
      expect.any(AuthenticationSession),
    );

    expect(ctx.redis.authenticationSessionCache.create).toHaveBeenCalled();
  });
});
