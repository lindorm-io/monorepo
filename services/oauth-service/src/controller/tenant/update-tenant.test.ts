import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { createTestTenant } from "../../fixtures/entity";
import { updateTenantController } from "./update-tenant";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        tenantCache: createMockCache(createTestTenant),
      },
      data: {
        active: false,
        name: "updated name",
        owner: "d7dc7f9f-90f8-4853-9695-933bdff59aff",
        subdomain: "updated subdomain",
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
    await expect(updateTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.tenantRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({
        active: false,
        name: "updated name",
        owner: "d7dc7f9f-90f8-4853-9695-933bdff59aff",
        subdomain: "updated subdomain",
      }),
    );
  });
});
