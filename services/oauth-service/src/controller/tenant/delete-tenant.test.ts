import { createMockRepository } from "@lindorm-io/mongo";
import { deleteTenantController } from "./delete-tenant";
import { createTestClient, createTestTenant } from "../../fixtures/entity";

describe("deleteTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        tenant: createTestTenant(),
      },
      repository: {
        clientRepository: createMockRepository(createTestClient),
        tenantRepository: createMockRepository(createTestTenant),
      },
    };
  });

  test("should resolve destroyed tenant", async () => {
    await expect(deleteTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.tenantRepository.destroy).toHaveBeenCalled();
    expect(ctx.repository.clientRepository.deleteMany).toHaveBeenCalled();
  });
});
