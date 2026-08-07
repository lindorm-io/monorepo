import { KryptosKit } from "@lindorm/kryptos";
import { describe, expect, test } from "vitest";
import { parseAes } from "../utils/parse-aes.js";
import { AesKit } from "./AesKit.js";

/**
 * The key selects the cipher. `defaultEncryption` is a FALLBACK for a key that
 * declares none — never an override of one that does.
 *
 * The two key families fail differently when that is inverted, which is why
 * both are here: a `dir` key throws (its secret is sized for the declaration),
 * while a key-wrapping key silently seals under the wrong AEAD, because its
 * content-encryption key is generated per message and any AEAD "works".
 */
describe("AesKit content-encryption selection", () => {
  describe("the key declares an encryption", () => {
    test("a dir key's declaration is honoured, not the kit's fallback", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A192CBC-HS384",
      });
      const kit = new AesKit({ kryptos, defaultEncryption: "A256GCM" });

      const sealed = kit.encrypt("payload", "cbor");

      expect(parseAes(sealed).encryption).toBe("A192CBC-HS384");
      expect(kit.decrypt(sealed)).toBe("payload");
    });

    test("a wrapping key's declaration is honoured, not the kit's fallback", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A256KW",
        encryption: "A128GCM",
      });
      const kit = new AesKit({ kryptos, defaultEncryption: "A256GCM" });

      const sealed = kit.encrypt("payload", "cbor");

      expect(parseAes(sealed).encryption).toBe("A128GCM");
      expect(kit.decrypt(sealed)).toBe("payload");
    });

    test("the content primitive follows the key too", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "dir",
        encryption: "A192CBC-HS384",
      });
      const kit = new AesKit({ kryptos, defaultEncryption: "A256GCM" });

      const { ciphertext, iv, tag } = kit.encryptContent(Buffer.from("bytes"));

      // A192CBC-HS384 is a 48-byte composite key: 24-byte AES + 24-byte HMAC,
      // and its tag is the 24-byte truncated HS384. A256GCM's would be 16.
      expect(tag.length).toBe(24);
      expect(
        kit.decryptContent({ ciphertext, encryption: "A192CBC-HS384", iv, tag }),
      ).toEqual(Buffer.from("bytes"));
    });
  });

  describe("the key declares nothing", () => {
    // `enc` is not a JWK member, so a recipient key imported from a peer's JWKS
    // carries no declaration. That is the case the fallback exists for.
    const bareKey = () => {
      const key = KryptosKit.generate.enc.oct({
        algorithm: "A256KW",
        encryption: "A128GCM",
      });
      return KryptosKit.from.jwk({ ...key.toJWK("private"), enc: undefined });
    };

    test("falls back to the kit's defaultEncryption", () => {
      const kryptos = bareKey();
      const kit = new AesKit({ kryptos, defaultEncryption: "A128CBC-HS256" });

      expect(kryptos.encryption).toBeNull();
      expect(parseAes(kit.encrypt("payload", "cbor")).encryption).toBe("A128CBC-HS256");
    });

    test("falls back to A256GCM when the kit names none either", () => {
      const kit = new AesKit({ kryptos: bareKey() });

      expect(parseAes(kit.encrypt("payload", "cbor")).encryption).toBe("A256GCM");
    });
  });

  // The headerless primitive is described by its input, not by the kit: the
  // sender's algorithm is the only one that can open the ciphertext.
  test("decryptContent takes its algorithm from the input, not the key", () => {
    // Both are 32-byte `dir` secrets, so the SAME key material is valid for
    // either AEAD — a kit-derived algorithm would pick the wrong one silently.
    const secret = KryptosKit.generate.enc.oct({
      algorithm: "dir",
      encryption: "A128CBC-HS256",
    });
    const declared = new AesKit({ kryptos: secret });
    const foreign = KryptosKit.from.jwk({ ...secret.toJWK("private"), enc: "A256GCM" });

    const { ciphertext, iv, tag } = new AesKit({ kryptos: foreign }).encryptContent(
      Buffer.from("from a peer"),
    );

    expect(
      declared.decryptContent({ ciphertext, encryption: "A256GCM", iv, tag }),
    ).toEqual(Buffer.from("from a peer"));
  });
});
