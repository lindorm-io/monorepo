import { describe, expect, test } from "vitest";
import { createTestAuthConfig } from "../../../__fixtures__/app-config.js";
import { deploymentCritical } from "./deployment-critical.js";

describe("deploymentCritical", () => {
  // No auth block declares nothing: aegis refuses every critical parameter.
  test("should resolve undefined when the deployment has no auth block", () => {
    expect(deploymentCritical(null)).toBeUndefined();
  });

  test("should resolve an empty array for an auth block declaring nothing", () => {
    expect(deploymentCritical(createTestAuthConfig())).toEqual([]);
  });

  // aegis's `VerifyOptions.critical` is a mutable `Array<string>`; the config's
  // array is frozen, so every call hands aegis its own copy.
  test("should hand out a fresh mutable copy per call", () => {
    const auth = createTestAuthConfig({ critical: Object.freeze(["objectId"]) });

    const first = deploymentCritical(auth);
    const second = deploymentCritical(auth);

    expect(first).toEqual(["objectId"]);
    expect(first).not.toBe(second);
    expect(first).not.toBe(auth.critical);
    expect(Object.isFrozen(first)).toBe(false);
    expect(() => first?.push("x")).not.toThrow();
    expect(auth.critical).toEqual(["objectId"]);
  });
});
