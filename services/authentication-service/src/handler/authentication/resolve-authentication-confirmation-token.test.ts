import { ClientError } from "@lindorm-io/errors";
import { CreateOpaqueToken, createOpaqueToken } from "@lindorm-io/jwt";
import { createMockRedisRepository } from "@lindorm-io/redis";
import { AuthenticationConfirmationToken } from "../../entity";
import { createTestAuthenticationConfirmationToken } from "../../fixtures/entity";
import { resolveAuthenticationConfirmationToken } from "./resolve-authentication-confirmation-token";

describe("resolveAuthenticationConfirmationToken", () => {
  let ctx: any;
  let authToken: CreateOpaqueToken;

  beforeEach(() => {
    ctx = {
      redis: {
        authenticationConfirmationTokenCache: createMockRedisRepository(
          createTestAuthenticationConfirmationToken,
        ),
      },
    };

    authToken = createOpaqueToken({ id: "31d061ae-0757-4ff1-8849-83580c26de28" });
  });

  test("should resolve", async () => {
    ctx.redis.authenticationConfirmationTokenCache.tryFind.mockResolvedValue(
      createTestAuthenticationConfirmationToken({
        id: "31d061ae-0757-4ff1-8849-83580c26de28",
        signature: authToken.signature,
      }),
    );

    await expect(
      resolveAuthenticationConfirmationToken(ctx, authToken.token),
    ).resolves.toStrictEqual(expect.any(AuthenticationConfirmationToken));
  });

  test("should throw on invalid token id", async () => {
    ctx.redis.authenticationConfirmationTokenCache.tryFind.mockResolvedValue(undefined);

    await expect(resolveAuthenticationConfirmationToken(ctx, authToken.token)).rejects.toThrow(
      ClientError,
    );
  });

  test("should throw on invalid token signature", async () => {
    ctx.redis.authenticationConfirmationTokenCache.tryFind.mockResolvedValue(
      createTestAuthenticationConfirmationToken({
        id: "31d061ae-0757-4ff1-8849-83580c26de28",
        signature: "wrong",
      }),
    );

    await expect(resolveAuthenticationConfirmationToken(ctx, authToken.token)).rejects.toThrow(
      ClientError,
    );
  });
});
