import { createMockRepository } from "@lindorm-io/mongo";
import { createTenantController } from "./create-tenant";

describe("createTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      data: {
        name: "name",
        subdomain: "subdomain",
      },
      repository: {
        tenantRepository: createMockRepository(),
      },
      token: {
        bearerToken: { subject: "identityId" },
      },
    };
  });

  test("should resolve created tenant", async () => {
    await expect(createTenantController(ctx)).resolves.toStrictEqual({
      body: { id: expect.any(String) },
      status: 201,
    });

    expect(ctx.repository.tenantRepository.create).toHaveBeenCalled();
  });
});
