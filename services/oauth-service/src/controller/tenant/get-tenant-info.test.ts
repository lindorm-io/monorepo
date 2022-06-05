import MockDate from "mockdate";
import { getTenantInfoController } from "./get-tenant-info";
import { createTestTenant } from "../../fixtures/entity";

MockDate.set("2021-01-01T08:00:00.000Z");

describe("getTenantInfoController", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: {
        tenant: createTestTenant(),
      },
    };
  });

  test("should resolve tenant", async () => {
    await expect(getTenantInfoController(ctx)).resolves.toMatchSnapshot();
  });
});
