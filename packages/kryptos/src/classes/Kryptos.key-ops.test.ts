import { describe, expect, test } from "vitest";
import { KryptosKit } from "./index.js";

// A public key cannot claim a private operation. WebCrypto (so `jose`, so every
// mainstream RP) passes a JWK's `key_ops` straight to `importKey()` as
// `keyUsages` and HARD REJECTS a public key that names `sign`/`deriveKey` — an
// RP could not import our JWKS at all. `key_ops` is OPTIONAL (RFC 7517 §4.3) and
// the public JWK already carries `use`, so the public export omits it entirely.
// The real-RP proof of this lives in aegis (`jose-interop.test.ts`); kryptos has
// no jose dependency, so here we pin the emitted shape.

const SIG: Array<[string, Parameters<typeof KryptosKit.generate.auto>[0]]> = [
  ["ES256", { algorithm: "ES256" }],
  ["RS256", { algorithm: "RS256" }],
  ["EdDSA", { algorithm: "EdDSA" }],
];

const ENC: Array<[string, Parameters<typeof KryptosKit.generate.auto>[0]]> = [
  ["ECDH-ES+A256KW", { algorithm: "ECDH-ES+A256KW", encryption: "A256GCM" }],
  ["RSA-OAEP-256", { algorithm: "RSA-OAEP-256", encryption: "A256GCM" }],
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

    test("should never emit key_ops even when operations are set explicitly", () => {
      const key = KryptosKit.generate.auto({
        algorithm: "ES256",
        operations: ["sign", "verify"],
      });

      expect("key_ops" in key.toJWK("public")).toBe(false);
    });

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
    test.each(SIG)("should emit the full operations list (%s)", (_name, options) => {
      const jwk = KryptosKit.generate.auto(options).toJWK("private");

      expect(jwk.key_ops).toEqual(["sign", "verify"]);
    });

    test("should emit deriveKey for an ECDH key", () => {
      const jwk = KryptosKit.generate
        .auto({ algorithm: "ECDH-ES+A256KW", encryption: "A256GCM" })
        .toJWK("private");

      expect(jwk.key_ops).toEqual(["deriveKey"]);
    });

    test("should emit wrapKey/unwrapKey for an RSA-OAEP key", () => {
      const jwk = KryptosKit.generate
        .auto({ algorithm: "RSA-OAEP-256", encryption: "A256GCM" })
        .toJWK("private");

      expect(jwk.key_ops).toEqual(["wrapKey", "unwrapKey"]);
    });
  });

  describe("import", () => {
    // Dropping key_ops from the public JWK must not strand any consumer that
    // filters on `operations` (aegis resolves its verify key with
    // `{ operations: ["verify"] }`). The import funnel re-derives the list from
    // alg/use when the JWK omits it, so operations stay populated.
    test.each([...SIG, ...ENC])(
      "should re-derive operations from a public JWK that omits key_ops (%s)",
      (_name, options) => {
        const key = KryptosKit.generate.auto(options);

        const imported = KryptosKit.from.jwk(key.toJWK("public"));

        expect(imported.operations).toEqual(key.operations);
      },
    );

    test("should preserve an explicit key_ops list from a private JWK", () => {
      const key = KryptosKit.generate.auto({ algorithm: "ES256" });

      const imported = KryptosKit.from.jwk(key.toJWK("private"));

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
