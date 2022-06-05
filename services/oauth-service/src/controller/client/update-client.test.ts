import MockDate from "mockdate";
import { DisplayMode, ResponseMode, Scope } from "../../common";
import { SCOPE_OPENID } from "../../constant";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";
import { updateClientController } from "./update-client";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      data: {
        defaults: {
          displayMode: DisplayMode.WAP,
          levelOfAssurance: 1,
          responseMode: ResponseMode.FRAGMENT,
        },
        description: "new description",
        expiry: {
          accessToken: "33 seconds",
          idToken: "44 seconds",
          refreshToken: "55 seconds",
        },
        host: "https://new.test.client.com",
        logoUri: "https://new.test.client.com/logo",
        logoutUri: "https://new.test.client.com/logout",
        name: "new client",
        redirectUris: ["https://new.test.client.com/redirect"],
        requiredScopes: [Scope.OPENID],
        rtbfUri: "https://new.test.client.com/rtbf",
        scopeDescriptions: [SCOPE_OPENID],
      },
      entity: {
        client: createTestClient({ id: "be664120-2430-4050-b56c-fd4176b652d9" }),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
      },
    };
  });

  test("should resolve updated client", async () => {
    await expect(updateClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.clientRepository.update.mock.calls).toMatchSnapshot();
    expect(ctx.cache.clientCache.update.mock.calls).toMatchSnapshot();
  });
});
