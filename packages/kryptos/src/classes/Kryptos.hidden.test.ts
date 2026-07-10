import { describe, expect, test } from "vitest";
import { KryptosKit } from "./index.js";

describe("Kryptos hidden attribute", () => {
  test.each([true, false])(
    "should round-trip hidden:%s through the env string",
    (hidden) => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", hidden });

      const restored = KryptosKit.env.import(KryptosKit.env.export(key));

      expect(restored.hidden).toBe(hidden);
    },
  );

  test.each([true, false])("should emit hidden:%s in the private JWK", (hidden) => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256", hidden });

    const jwk = key.toJWK("private");

    expect(jwk.hidden).toBe(hidden);
  });

  test.each([true, false])(
    "should never emit the hidden member in the public JWK (hidden:%s)",
    (hidden) => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", hidden });

      const jwk = key.toJWK("public");

      expect("hidden" in jwk).toBe(false);
    },
  );

  test("should default hidden:false when importing a legacy JWK without the member", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256", hidden: true });

    // Simulate a pre-change env string: a private JWK with no `hidden` member.
    const legacy = key.toJWK("private");
    delete (legacy as { hidden?: boolean }).hidden;

    const imported = KryptosKit.from.jwk(legacy);

    expect(imported.hidden).toBe(false);
  });

  test("should keep an oct key hidden across the env round trip", () => {
    const key = KryptosKit.generate.auto({ algorithm: "A256KW", hidden: true });

    const restored = KryptosKit.env.import(KryptosKit.env.export(key));

    expect(restored.hidden).toBe(true);
    expect("hidden" in key.toJWK("public")).toBe(false);
  });
});
