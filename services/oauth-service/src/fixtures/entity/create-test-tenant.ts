import { Tenant, TenantOptions } from "../../entity";

export const createTestTenant = (options: Partial<TenantOptions> = {}): Tenant =>
  new Tenant({
    active: true,
    name: "TenantName",
    owner: "0bbfd773-7eed-402b-83f3-916288ff978c",
    subdomain: "test-name",

    ...options,
  });
