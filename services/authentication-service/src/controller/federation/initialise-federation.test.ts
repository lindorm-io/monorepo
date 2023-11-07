import { createMockRedisRepository } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";
import { initialiseFederationController } from "./initialise-federation";

describe("initialiseFederationController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      id: "048b2a65-3aeb-4839-a0a9-c647879bc2e3",
      identityId: null,
    });

    ctx = {
      axios: {
        federationClient: {
          post: jest.fn().mockResolvedValue({ data: { redirectTo: "redirectTo" } }),
        },
      },
      redis: {
        authenticationSessionCache: createMockRedisRepository(createTestAuthenticationSession),
      },
      data: {
        provider: "provider",
        remember: undefined,
      },
      entity: {
        authenticationSession,
      },
    };
  });

  test("should resolve", async () => {
    await expect(initialiseFederationController(ctx)).resolves.toStrictEqual({
      redirect: "redirectTo",
    });

    expect(ctx.axios.federationClient.post).toHaveBeenCalledWith("/admin/sessions", {
      body: {
        callbackId: "048b2a65-3aeb-4839-a0a9-c647879bc2e3",
        callbackUri: "https://authentication.test.lindorm.io:3001/sessions/federation/callback",
        expires: "2022-01-01T08:00:00.000Z",
        identityId: undefined,
        provider: "provider",
      },
      middleware: expect.any(Array),
    });
  });

  test("should update authentication session with remember", async () => {
    ctx.data.remember = "remember";

    await expect(initialiseFederationController(ctx)).resolves.toBeTruthy();

    expect(ctx.redis.authenticationSessionCache.update).toHaveBeenCalled();
  });
});
