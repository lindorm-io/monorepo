import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationConfirmationToken } from "../../fixtures/entity";
import { tokenExchangeController } from "./exchange";

describe("tokenExchangeController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: { token: "opaque.token" },
      jwt: {
        sign: jest.fn().mockReturnValue({
          token: "jwt.jwt.jwt",
          expiresIn: 60,
        }),
      },
      redis: {
        authenticationConfirmationTokenCache: createMockRedisRepository(
          createTestAuthenticationConfirmationToken,
        ),
      },
    };
  });

  test("should resolve", async () => {
    await expect(tokenExchangeController(ctx)).resolves.toStrictEqual({
      body: {
        expiresIn: 60,
        token: "jwt.jwt.jwt",
      },
    });
  });
});
