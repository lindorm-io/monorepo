import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { deleteClientController } from "./delete-client";
import { createTestClient } from "../../fixtures/entity";

describe("deleteClientController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        clientCache: createMockCache(createTestClient),
      },
      entity: {
        client: createTestClient(),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
      },
    };
  });

  test("should resolve destroyed client", async () => {
    await expect(deleteClientController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.clientRepository.destroy).toHaveBeenCalled();
    expect(ctx.cache.clientCache.destroy).toHaveBeenCalled();
  });
});
