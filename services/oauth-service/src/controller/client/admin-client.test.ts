import MockDate from "mockdate";
import { ClientPermission, ClientType, GrantType, ResponseType, Scope } from "../../common";
import { adminClientController } from "./admin-client";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestClient } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("adminClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      data: {
        active: false,
        allowed: {
          grantTypes: [GrantType.REFRESH_TOKEN],
          responseTypes: [ResponseType.TOKEN],
          scopes: [Scope.OPENID],
        },
        permissions: [ClientPermission.OAUTH_PUBLIC],
        type: ClientType.PUBLIC,
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
    await expect(adminClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.clientRepository.update.mock.calls).toMatchSnapshot();
    expect(ctx.cache.clientCache.update.mock.calls).toMatchSnapshot();
  });
});
