import MockDate from "mockdate";
import { adminTenantController } from "./admin-tenant";
import { getTestTenant } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("adminTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        tenantCache: {
          update: jest.fn(),
        },
      },
      data: {
        active: false,
        owner: "d7dc7f9f-90f8-4853-9695-933bdff59aff",
      },
      entity: {
        tenant: getTestTenant({ id: "612edde0-2679-47b1-8fad-d01c8a7570b6" }),
      },
      repository: {
        tenantRepository: {
          update: jest
            .fn()
            .mockImplementation(async (entity) => ({ ...entity, version: (entity.version += 1) })),
        },
      },
    };
  });

  test("should resolve updated tenant", async () => {
    await expect(adminTenantController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.tenantRepository.update.mock.calls).toMatchSnapshot();
  });
});
