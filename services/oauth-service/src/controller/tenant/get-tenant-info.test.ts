import MockDate from "mockdate";
import { createTestTenant } from "../../fixtures/entity";
import { getTenantInfoController } from "./get-tenant-info";

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
    await expect(getTenantInfoController(ctx)).resolves.toStrictEqual({
      body: {
        active: true,
        name: "TenantName",
        owner: "0bbfd773-7eed-402b-83f3-916288ff978c",
        subdomain: "test-name",
        trusted: true,
      },
    });
  });
});
