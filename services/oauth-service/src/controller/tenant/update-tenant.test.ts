import MockDate from "mockdate";
import { createMockCache } from "@lindorm-io/redis";
import { createMockRepository } from "@lindorm-io/mongo";
import { getTestTenant } from "../../test/entity";
import { updateTenantController } from "./update-tenant";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        tenantCache: createMockCache(),
      },
      data: {
        administrators: ["78024d32-488c-458e-9f5c-d4a15c83759c"],
        name: "new name",
        owner: "d7dc7f9f-90f8-4853-9695-933bdff59aff",
        subdomain: "new-subdomain",
      },
      entity: {
        tenant: getTestTenant({ id: "612edde0-2679-47b1-8fad-d01c8a7570b6" }),
      },
      repository: {
        tenantRepository: createMockRepository(),
      },
    };
  });

  test("should resolve updated tenant", async () => {
    await expect(updateTenantController(ctx)).resolves.toBeUndefined();

    expect(ctx.repository.tenantRepository.update.mock.calls).toMatchSnapshot();
  });
});
