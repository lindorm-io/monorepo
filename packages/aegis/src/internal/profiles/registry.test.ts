import { AegisDomainError } from "../../errors/index.js";
import type { TokenProfileInput } from "../../types/index.js";
import { createProfileRegistry } from "./registry.js";
import { describe, expect, test } from "vitest";

const CUSTOM: TokenProfileInput = {
  name: "custom_test_profile",
  typ: { presence: "required", value: "custom+jwt" },
  policy: [{ rule: "required", on: ["mint", "verify"], claims: ["subject"] }],
  autoInject: [],
  issuer: "platform",
  lifetime: null,
  encryptable: false,
};

describe("createProfileRegistry", () => {
  test("resolves the built-in default profile", () => {
    expect(createProfileRegistry().resolve("default")).toMatchObject({
      name: "default",
      autoInject: ["issuedAt", "tokenId", "notBefore", "issuer"],
    });
  });

  test("throws for an unknown profile", () => {
    expect(() => createProfileRegistry().resolve("does_not_exist")).toThrow(
      AegisDomainError,
    );
  });

  // A consumer's profile omits `use`, and the registry resolves it to "both" —
  // the whole point of the default, since it leaves every existing custom
  // profile mint-and-verify exactly as before.
  test("registers and resolves a custom profile, defaulting its use", () => {
    const registry = createProfileRegistry();

    registry.register(CUSTOM);

    expect(registry.resolve("custom_test_profile")).toEqual({
      ...CUSTOM,
      use: "both",
    });
  });

  test("keeps an explicitly declared use", () => {
    const registry = createProfileRegistry();

    registry.register({ ...CUSTOM, name: "custom_verify_only", use: "verify" });

    expect(registry.resolve("custom_verify_only").use).toBe("verify");
  });

  // The registration is scoped to the registry it was made on. As a module-global
  // map, one consumer registering a profile — or one NAMED after a built-in —
  // redefined what every other Aegis in the process minted and verified.
  test("a registration does not reach another registry", () => {
    const one = createProfileRegistry();
    const two = createProfileRegistry();

    one.register(CUSTOM);

    expect(one.resolve("custom_test_profile").name).toBe("custom_test_profile");
    expect(() => two.resolve("custom_test_profile")).toThrow(AegisDomainError);
  });

  test("shadowing a built-in does not reach another registry", () => {
    const one = createProfileRegistry();
    const two = createProfileRegistry();

    one.register({ ...CUSTOM, name: "access_token", lifetime: "9h" });

    expect(one.resolve("access_token").lifetime).toBe("9h");
    expect(two.resolve("access_token").lifetime).toBe("1h");
  });
});
