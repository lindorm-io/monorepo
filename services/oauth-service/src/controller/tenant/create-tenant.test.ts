import { createMockMongoRepository } from "@lindorm-io/mongo";
import { createTenantController } from "./create-tenant";
import { createTestTenant } from "../../fixtures/entity";

describe("createTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        name: "name",
        owner: "66112712-c17b-4ba1-8e01-132d3e322bad",
        subdomain: "subdomain",
      },
      mongo: {
        tenantRepository: createMockMongoRepository(createTestTenant),
      },
    };
  });

  test("should resolve created tenant", async () => {
    await expect(createTenantController(ctx)).resolves.toStrictEqual({
      body: { id: expect.any(String) },
      status: 201,
    });

    expect(ctx.mongo.tenantRepository.create).toHaveBeenCalled();
  });
});
