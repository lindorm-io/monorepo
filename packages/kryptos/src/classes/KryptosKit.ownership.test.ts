import { TEST_OCT_KEY_JWK } from "../__fixtures__/oct-keys.js";
import { KryptosKit } from "./KryptosKit.js";
import { describe, expect, test } from "vitest";

// Ownership (isExternal) is decided by the IMPORT PATH, never by the payload:
// env-provided keys are the service's own; direct JWK imports default to
// external (remote JWKS shape); the caller flag overrides explicitly.
describe("KryptosKit ownership", () => {
  test("env.import marks the key as own", () => {
    const exported = KryptosKit.env.export(KryptosKit.from.jwk(TEST_OCT_KEY_JWK));

    expect(KryptosKit.env.import(exported).isExternal).toBe(false);
  });

  test("from.jwk defaults to external", () => {
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK).isExternal).toBe(true);
  });

  test("from.jwk honors an explicit ownership flag", () => {
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK, false).isExternal).toBe(false);
    expect(KryptosKit.from.jwk(TEST_OCT_KEY_JWK, true).isExternal).toBe(true);
  });

  test("a payload-borne isExternal is ignored", () => {
    const planted = { ...TEST_OCT_KEY_JWK, isExternal: false } as typeof TEST_OCT_KEY_JWK;

    expect(KryptosKit.from.jwk(planted).isExternal).toBe(true);
  });
});
