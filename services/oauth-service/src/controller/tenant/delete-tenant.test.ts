import { createMockMongoRepository } from "@lindorm-io/mongo";
import { deleteTenantController } from "./delete-tenant";
import { createTestClient, createTestTenant } from "../../fixtures/entity";

describe("deleteTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        tenant: createTestTenant(),
      },
      mongo: {
        clientRepository: createMockMongoRepository(createTestClient),
        tenantRepository: createMockMongoRepository(createTestTenant),
      },
    };
  });

  test("should resolve destroyed tenant", async () => {
    await expect(deleteTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.mongo.tenantRepository.destroy).toHaveBeenCalled();
    expect(ctx.mongo.clientRepository.deleteMany).toHaveBeenCalled();
  });
});
