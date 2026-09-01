import { describe, expect, test } from "vitest";
import { KryptosKit } from "./index.js";

describe("Kryptos publish attribute", () => {
  test.each(["cbor", "json"] as const)(
    "should round-trip publish:true through the %s env string",
    (format) => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", publish: true });

      const restored = KryptosKit.env.import(KryptosKit.env.export(key, format));

      expect(restored.publish).toBe(true);
    },
  );

  test.each(["cbor", "json"] as const)(
    "should round-trip publish:false through the %s env string",
    (format) => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", publish: false });

      const restored = KryptosKit.env.import(KryptosKit.env.export(key, format));

      expect(restored.publish).toBe(false);
    },
  );

  test.each([true, false])("should emit publish:%s in the private JWK", (publish) => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256", publish });

    const jwk = key.toJWK("private");

    expect(jwk.publish).toBe(publish);
  });

  test.each([true, false])(
    "should never emit the publish member in the public JWK (publish:%s)",
    (publish) => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", publish });

      const jwk = key.toJWK("public");

      expect("publish" in jwk).toBe(false);
    },
  );

  test("should keep an internal oct key unpublished across the env round trip", () => {
    const key = KryptosKit.generate.auto({ algorithm: "A256KW", publish: false });

    const restored = KryptosKit.env.import(KryptosKit.env.export(key));

    expect(restored.publish).toBe(false);
    // The flag survives in the PRIVATE JWK, which is what the env string carries.
    expect(key.toJWK("private").publish).toBe(false);
  });

  test("should carry publish through toDB and toJSON", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256", publish: false });

    expect(key.toDB().publish).toBe(false);
    expect(key.toJSON().publish).toBe(false);
    expect(KryptosKit.from.db(key.toDB()).publish).toBe(false);
  });

  // `publish` is NEVER inferred. `purpose` is a free-form string owned by the
  // consumer — "cookie"/"session" is pylon's vocabulary, not kryptos's — so the
  // library must not read publication policy out of it. These read
  // counter-intuitively on purpose: they pin the contract so the magic cannot be
  // reintroduced silently. Keeping an internal key out of the JWKS is the
  // caller's job, stated explicitly.
  describe("purpose never infers the flag", () => {
    test.each(["cookie", "session", "token"])(
      "should leave a %s key unpublished by default — purpose carries no policy",
      (purpose) => {
        const key = KryptosKit.generate.auto({ algorithm: "HS256", purpose });

        expect(key.publish).toBe(false);
      },
    );

    // A "token" key is the one that genuinely belongs in the JWKS — and it still
    // has to ask. No purpose is special-cased in either direction.
    test.each(["cookie", "session", "token"])(
      "should honour an explicit publish:true on a %s key",
      (purpose) => {
        const key = KryptosKit.generate.auto({
          algorithm: "HS256",
          purpose,
          publish: true,
        });

        expect(key.publish).toBe(true);
      },
    );
  });

  describe("construction paths", () => {
    test("should default publish:false on the derive path", () => {
      const seed = KryptosKit.generate.auto({ algorithm: "A256KW" });

      const derived = KryptosKit.from.derive({
        type: "oct",
        use: "sig",
        algorithm: "HS256",
        deriveFrom: seed,
        path: "urn:lindorm:test:kek:v1",
      });

      expect(derived.publish).toBe(false);
    });

    test("should default publish:false on the utf path", () => {
      const key = KryptosKit.from.utf({
        type: "oct",
        use: "sig",
        algorithm: "HS256",
        privateKey: "a-client-secret-long-enough-to-be-valid-for-hs256",
      });

      expect(key.publish).toBe(false);
    });

    test("should round-trip an explicit value through the db path", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256", publish: true });

      expect(KryptosKit.from.db(key.toDB()).publish).toBe(true);
    });
  });
});
