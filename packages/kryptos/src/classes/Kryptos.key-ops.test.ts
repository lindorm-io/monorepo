import { describe, expect, test } from "vitest";
import { KryptosKit } from "./index.js";

// `key_ops` is NEVER emitted, in EITHER export mode. RFC 7517 §4.3 makes it
// OPTIONAL and says it SHOULD NOT be paired with `use` — which every JWK we emit
// carries — and it has no readers: `operations` is a derived capability of the
// key material, re-derived on import. Emitting it was also an active bug: a
// private JWK claiming ["sign","verify"] is rejected by jose/WebCrypto for every
// asymmetric algorithm, because WebCrypto models ONE CryptoKey with ONE type.
// These tests pin the emitted shape so a re-add is caught.

const SIG: Array<[string, Parameters<typeof KryptosKit.generate.auto>[0]]> = [
  ["ES256", { algorithm: "ES256" }],
  ["RS256", { algorithm: "RS256" }],
  ["EdDSA", { algorithm: "EdDSA" }],
];

const ENC: Array<[string, Parameters<typeof KryptosKit.generate.auto>[0]]> = [
  ["ECDH-ES+A256KW", { algorithm: "ECDH-ES+A256KW", encryption: "A256GCM" }],
  ["RSA-OAEP-256", { algorithm: "RSA-OAEP-256", encryption: "A256GCM" }],
  ["A256KW", { algorithm: "A256KW", encryption: "A256GCM" }],
];

describe("Kryptos key_ops attribute", () => {
  describe("public JWK", () => {
    test.each([...SIG, ...ENC])(
      "should never emit the key_ops member (%s)",
      (_name, options) => {
        const jwk = KryptosKit.generate.auto(options).toJWK("public");

        expect("key_ops" in jwk).toBe(false);
      },
    );

    test("should still carry `use`, which conveys the intent instead", () => {
      const sig = KryptosKit.generate.auto({ algorithm: "ES256" }).toJWK("public");
      const enc = KryptosKit.generate
        .auto({
          algorithm: "ECDH-ES+A256KW",
          encryption: "A256GCM",
        })
        .toJWK("public");

      expect(sig.use).toBe("sig");
      expect(enc.use).toBe("enc");
    });
  });

  describe("private JWK", () => {
    test.each([...SIG, ...ENC])(
      "should never emit the key_ops member (%s)",
      (_name, options) => {
        const jwk = KryptosKit.generate.auto(options).toJWK("private");

        expect("key_ops" in jwk).toBe(false);
      },
    );
  });

  describe("import", () => {
    // The JWK carries no key_ops, so `operations` must come back from the key
    // material alone — and the halves the export mode actually carried.
    test.each([...SIG, ...ENC])(
      "should re-derive operations from a private JWK (%s)",
      (_name, options) => {
        const key = KryptosKit.generate.auto(options);

        const imported = KryptosKit.from.jwk(key.toJWK("private"));

        expect(imported.operations).toEqual(key.operations);
      },
    );

    test("should re-derive the public-half operations from a public JWK", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      const imported = KryptosKit.from.jwk(key.toJWK("public"));

      expect(key.operations).toEqual(["sign", "verify"]);
      expect(imported.operations).toEqual(["verify"]);
    });

    // A remote party's odd key_ops is not our failure: it is ignored, never
    // trusted and never a throw.
    test("should ignore an incoming key_ops that contradicts the key material", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      const imported = KryptosKit.from.jwk({
        ...key.toJWK("private"),
        key_ops: ["verify"],
      });

      expect(imported.operations).toEqual(["sign", "verify"]);
    });
  });

  test("should keep the key id stable — key_ops is not a thumbprint member", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });

    const imported = KryptosKit.from.jwk(key.toJWK("public"));

    expect(imported.id).toBe(key.id);
    expect(imported.thumbprint).toBe(key.thumbprint);
  });

  test("should round-trip operations through the env string", () => {
    const key = KryptosKit.generate.auto({ algorithm: "ES256" });

    const restored = KryptosKit.env.import(KryptosKit.env.export(key));

    expect(restored.operations).toEqual(["sign", "verify"]);
  });
});
