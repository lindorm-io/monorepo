import { AegisDomainError } from "../../errors/index.js";
import type { TokenProfileInput } from "../../types/index.js";
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

  // A consumer's profile omits `use`, and the registry resolves it to "both" —
  // the whole point of the default, since it leaves every existing custom
  // profile mint-and-verify exactly as before.
  test("registers and resolves a custom profile, defaulting its use", () => {
    const custom: TokenProfileInput = {
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

    expect(resolveProfile("custom_test_profile")).toEqual({ ...custom, use: "both" });
  });

  test("keeps an explicitly declared use", () => {
    registerProfile({
      name: "custom_verify_only_profile",
      use: "verify",
      typ: { presence: "none" },
      required: [],
      forbidden: [],
      requiredWhen: [],
      atLeastOneOf: [],
      autoInject: [],
      issuer: "per-token",
      lifetime: null,
      encryptable: false,
      validate: () => [],
    });

    expect(resolveProfile("custom_verify_only_profile").use).toBe("verify");
  });
});
