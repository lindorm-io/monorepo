import { initialiseOidcController } from "./initialise-oidc";
import { createMockCache } from "@lindorm-io/redis";
import { createTestAuthenticationSession } from "../../fixtures/entity";

describe("initialiseOidcController", () => {
  let ctx: any;

  beforeEach(() => {
    const authenticationSession = createTestAuthenticationSession({
      id: "048b2a65-3aeb-4839-a0a9-c647879bc2e3",
      identityId: null,
    });

    ctx = {
      axios: {
        oauthClient: {},
        oidcClient: {
          post: jest.fn().mockResolvedValue({ data: { redirectTo: "redirectTo" } }),
        },
      },
      cache: {
        authenticationSessionCache: createMockCache(createTestAuthenticationSession),
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
    await expect(initialiseOidcController(ctx)).resolves.toStrictEqual({ redirect: "redirectTo" });

    expect(ctx.axios.oidcClient.post).toHaveBeenCalledWith("/internal/sessions", {
      body: {
        callbackId: "048b2a65-3aeb-4839-a0a9-c647879bc2e3",
        callbackUri: "https://authentication.test.lindorm.io:3001/sessions/oidc/callback",
        expiresAt: "2022-01-01T08:00:00.000Z",
        identityId: undefined,
        provider: "provider",
      },
      middleware: expect.any(Array),
    });
  });

  test("should update authentication session with remember", async () => {
    ctx.data.remember = "remember";

    await expect(initialiseOidcController(ctx)).resolves.toBeTruthy();

    expect(ctx.cache.authenticationSessionCache.update).toHaveBeenCalled();
  });
});
