import type { AppAuthConfig, AppConfig } from "../types/index.js";

/**
 * A deployment policy with every feature OFF and no auth block — the shape a
 * bare pylon serves. Tests widen exactly the entry they are about, so a test
 * that never mentions rate limiting cannot accidentally depend on it.
 */
export const createTestAppConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  audit: false,
  responseCache: false,
  rateLimit: false,
  auth: null,
  ...overrides,
});

/** A configured auth block with both capabilities and NO driver-response cache. */
export const createTestAuthConfig = (
  overrides: Partial<AppAuthConfig> = {},
): AppAuthConfig => ({
  issuer: "https://test.lindorm.io/",
  clientId: "client-a",
  capabilities: { introspect: true, userinfo: true },
  cache: false,
  ...overrides,
});
