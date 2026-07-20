import { AegisDomainError } from "../../errors/index.js";
import type { TokenProfile } from "../../types/index.js";
import { registerProfile, resolveProfile } from "./registry.js";
import { describe, expect, test } from "vitest";

describe("registry", () => {
  test("resolves the built-in default profile", () => {
    expect(resolveProfile("default")).toMatchObject({
      name: "default",
      required: ["subject", "expiresAt"],
      autoInject: ["issuedAt", "tokenId", "notBefore", "issuer"],
    });
  });

  test("throws for an unknown profile", () => {
    expect(() => resolveProfile("does_not_exist")).toThrow(AegisDomainError);
  });

  test("registers and resolves a custom profile", () => {
    const custom: TokenProfile = {
      name: "custom_test_profile",
      typ: { presence: "required", value: "custom+jwt" },
      required: ["subject"],
      forbidden: [],
      requiredWhen: [],
      atLeastOneOf: [],
      autoInject: [],
      issuer: "platform",
      lifetime: null,
      encryptable: false,
      validate: () => [],
    };

    registerProfile(custom);

    expect(resolveProfile("custom_test_profile")).toBe(custom);
  });
});
