import type { AppAuthConfig, AppConfig } from "../types/index.js";

/**
 * The shape a bare pylon serves: audit off, no auth block, and a rate-limit
 * policy that imposes nothing. Tests widen exactly the entry they are about, so
 * a test that never mentions rate limiting cannot accidentally depend on it.
 *
 * ⚠ `rateLimit` has no off state to default to — the block is policy, not a
 * switch, so "no `rateLimit` configured" IS a resolved policy with no window and
 * no ceiling. A mount inheriting this one must state its own limits or throw.
 */
export const createTestAppConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  audit: false,
  rateLimit: { strategy: "fixed", window: null, max: null },
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
