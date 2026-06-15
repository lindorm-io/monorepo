import { JwtError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";
import { registerProfile, resolveProfile } from "./registry.js";
import { describe, expect, test } from "vitest";

describe("registry", () => {
  test("resolves the built-in default profile", () => {
    expect(resolveProfile("default")).toMatchObject({
      name: "default",
      required: ["subject", "expiresAt"],
      autoInject: { iat: true, jti: true, nbf: true, iss: true },
    });
  });

  test("throws for an unknown profile", () => {
    expect(() => resolveProfile("does_not_exist")).toThrow(JwtError);
  });

  test("registers and resolves a custom profile", () => {
    const custom: TokenProfile = {
      name: "custom_test_profile",
      typ: "custom+jwt",
      required: ["subject"],
      forbidden: [],
      requiredWhen: [],
      atLeastOneOf: [],
      autoInject: { iat: false, jti: false, nbf: false, iss: false },
      issuer: "platform",
      lifetime: null,
      encryptable: false,
      validate: () => [],
    };

    registerProfile(custom);

    expect(resolveProfile("custom_test_profile")).toBe(custom);
  });
});
