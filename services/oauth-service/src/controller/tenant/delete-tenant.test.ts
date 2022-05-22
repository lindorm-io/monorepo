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
        clientRepository: {
          deleteMany: jest.fn(),
        },
        tenantRepository: {
          destroy: jest.fn(),
        },
      },
    };
  });

  test("should resolve destroyed tenant", async () => {
    await expect(deleteTenantController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.tenantRepository.destroy).toHaveBeenCalled();
    expect(ctx.repository.clientRepository.deleteMany).toHaveBeenCalled();
  });
});
