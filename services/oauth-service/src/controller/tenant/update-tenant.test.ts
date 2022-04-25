import MockDate from "mockdate";
import { updateTenantController } from "./update-tenant";
import { getTestTenant } from "../../test/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("updateTenantController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      cache: {
        tenantCache: {
          update: jest.fn(),
        },
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
        tenantRepository: {
          update: jest
            .fn()
            .mockImplementation(async (entity) => ({ ...entity, version: (entity.version += 1) })),
        },
      },
    };
  });

  test("should resolve updated tenant", async () => {
    await expect(updateTenantController(ctx)).resolves.toStrictEqual({
      body: {},
    });

    expect(ctx.repository.tenantRepository.update.mock.calls).toMatchSnapshot();
  });
});
