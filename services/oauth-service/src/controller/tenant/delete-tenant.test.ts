import { createMockRepository } from "@lindorm-io/mongo";
import { deleteTenantController } from "./delete-tenant";
import { getTestTenant } from "../../test/entity";

describe("deleteTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        tenant: getTestTenant(),
      },
      repository: {
        clientRepository: createMockRepository(),
        tenantRepository: createMockRepository(),
      },
    };
  });

  test("should resolve destroyed tenant", async () => {
    await expect(deleteTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.tenantRepository.destroy).toHaveBeenCalled();
    expect(ctx.repository.clientRepository.deleteMany).toHaveBeenCalled();
  });
});
