import MockDate from "mockdate";
import { adminTenantController } from "./admin-tenant";
import { createTestTenant } from "../../fixtures/entity";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("adminTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        tenantCache: createMockCache(createTestTenant),
      },
      data: {
        active: false,
        owner: "d7dc7f9f-90f8-4853-9695-933bdff59aff",
      },
      entity: {
        tenant: createTestTenant({ id: "612edde0-2679-47b1-8fad-d01c8a7570b6" }),
      },
      repository: {
        tenantRepository: createMockRepository(createTestTenant),
      },
    };
  });

  test("should resolve updated tenant", async () => {
    await expect(adminTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.tenantRepository.update.mock.calls).toMatchSnapshot();
  });
});
