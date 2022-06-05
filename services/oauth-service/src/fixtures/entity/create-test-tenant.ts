import { Tenant, TenantOptions } from "../../entity";

export const createTestTenant = (options: Partial<TenantOptions> = {}): Tenant =>
  new Tenant({
    active: true,
    administrators: [
      "0bbfd773-7eed-402b-83f3-916288ff978c",
      "330ae1ab-a858-4234-9f6a-01304be2f577",
    ],
    name: "Test Name",
    owner: "0bbfd773-7eed-402b-83f3-916288ff978c",
    subdomain: "test-name",

    ...options,
  });
