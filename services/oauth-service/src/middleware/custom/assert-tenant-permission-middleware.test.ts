import MockDate from "mockdate";
import { assertTenantPermissionMiddleware } from "./assert-tenant-permission-middleware";
import { createTestTenant } from "../../fixtures/entity";
import { ClientError } from "@lindorm-io/errors";

MockDate.set("2021-01-01T08:00:00.000Z");

const next = async () => await Promise.resolve();

describe("assertTenantPermissionMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      entity: { tenant: createTestTenant() },
      token: {
        bearerToken: { subject: "0bbfd773-7eed-402b-83f3-916288ff978c" },
      },
    };
  });

  test("should resolve", async () => {
    await expect(assertTenantPermissionMiddleware(ctx, next)).resolves.toBeUndefined();
  });

  test("should reject on active", async () => {
    ctx.entity.tenant.active = false;
    await expect(assertTenantPermissionMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });

  test("should reject on administrators", async () => {
    ctx.token.bearerToken.subject = "d5e980bb-3638-431b-8b76-46f23457c174";
    await expect(assertTenantPermissionMiddleware(ctx, next)).rejects.toThrow(ClientError);
  });
});
