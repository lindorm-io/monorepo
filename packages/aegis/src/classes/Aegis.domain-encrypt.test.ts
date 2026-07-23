import { Amphora, type IAmphora } from "@lindorm/amphora";
import { B64 } from "@lindorm/b64";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_ENC,
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_RSA_KEY_ENC,
} from "../__fixtures__/keys.js";
import { CweError } from "../errors/index.js";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

// The domain confidentiality surface (§5e): `aegis.encrypt` / `aegis.decrypt`,
// the mirror of `aegis.sign`. Pure confidentiality — NO inner signature — so a
// token it produces DECRYPTS but is REJECTED by `aegis.verify`.
describe("Aegis — domain encrypt / decrypt (§5e)", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ domain: ISSUER, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_EC_KEY_SIG); // ES512 signer (for the mint/verify comparison)
    amphora.add(TEST_EC_KEY_ENC); // ECDH-ES recipient key (JWE)
    amphora.add(TEST_OCT_KEY_ENC); // dir recipient key (COSE_Encrypt0)
  });

  const claims = {
    subject: "user-1",
    audience: ["client-1"],
    tenant: "acme", // custom claim — not in the registry
  };

  describe("jwe", () => {
    test("round-trips a domain claims set through encrypt → decrypt", async () => {
      const encrypted = await aegis.encrypt(claims, { format: "jwe" });

      expect(encrypted.format).toBe("jwe");
      expect(JweKit.isJwe(encrypted.token)).toBe(true);

      const decrypted = await aegis.decrypt(encrypted.token);

      expect(decrypted.format).toBe("jwe");
      expect(decrypted.contentType).toBe("application/json");
      // The domain header is stamped `baseFormat: "JWE"` — decrypt routes the wire
      // header through the SAME `joseDomainHeader` enrichment as verify, not a bare
      // `parseTokenHeader` (which used to leave `baseFormat`/`tokenType` undefined).
      expect(decrypted.header.baseFormat).toBe("JWE");
      // Registered claims land domain-keyed under `claims`; the unregistered
      // `tenant` lands under `custom` — no signature was checked.
      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });
      expect(decrypted.custom).toEqual({ tenant: "acme" });
    });

    test("decrypt derives header.tokenType from the wire typ (regression: was always undefined)", async () => {
      const encrypted = await aegis.encrypt(claims, {
        format: "jwe",
        type: "access_token",
      });

      const decrypted = await aegis.decrypt(encrypted.token);

      expect(decrypted.header.baseFormat).toBe("JWE");
      expect(decrypted.header.tokenType).toBe("access_token");
    });

    test("round-trips an opaque string verbatim under `raw`", async () => {
      const encrypted = await aegis.encrypt("session-state-opaque", { format: "jwe" });
      const decrypted = await aegis.decrypt(encrypted.token);

      expect(decrypted.raw).toBe("session-state-opaque");
      expect(decrypted.contentType).toBe("text/plain");
      expect(decrypted.claims).toEqual({});
      expect(decrypted.custom).toEqual({});
    });
  });

  describe("cwe", () => {
    test("round-trips a domain claims set through encrypt → decrypt", async () => {
      const encrypted = await aegis.encrypt(claims, { format: "cwe" });

      expect(encrypted.format).toBe("cwe");
      // A bare COSE_Encrypt0 (CBOR tag 16 = 0xd0).
      expect(Buffer.from(encrypted.token, "base64url")[0]).toBe(0xd0);

      const decrypted = await aegis.decrypt(encrypted.token);

      expect(decrypted.format).toBe("cwe");
      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });
      expect(decrypted.custom).toEqual({ tenant: "acme" });
    });

    test("round-trips opaque bytes verbatim under `raw`", async () => {
      const secret = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe]);

      const encrypted = await aegis.encrypt(secret, { format: "cwe" });
      const decrypted = await aegis.decrypt(encrypted.token);

      expect(Buffer.isBuffer(decrypted.raw)).toBe(true);
      expect((decrypted.raw as Buffer).equals(secret)).toBe(true);
      expect(decrypted.claims).toEqual({});
    });
  });

  describe("decrypt does NOT verify a signature (authenticity is verify's job)", () => {
    test("an unsigned encrypted claims set decrypts, but verify rejects it", async () => {
      const { token } = await aegis.encrypt(claims, { format: "jwe" });

      // decrypt = confidentiality: it reads the claims with no signature check.
      const decrypted = await aegis.decrypt(token);
      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });

      // verify = authenticity: the decrypted inner is a bare claims set, not a
      // signed token, so verify refuses it.
      await expect(aegis.verify(token)).rejects.toMatchObject({
        code: "verify_requires_signature",
      });
    });

    test("refuses a non-encrypted token", async () => {
      const signed = await aegis.sign({ payload: { hello: "world" } });

      await expect(aegis.decrypt(signed.token)).rejects.toMatchObject({
        code: "decrypt_requires_encrypted",
      });
    });
  });

  describe("proprietary threads to the CWE content encryption (D5)", () => {
    test("a non-COSE-RFC encryption is rejected unless proprietary is set", async () => {
      // AES-CBC-HMAC has no official COSE registration — the interop gate throws.
      await expect(
        aegis.encrypt(claims, {
          format: "cwe",
          key: { encryption: "A128CBC-HS256" },
        }),
      ).rejects.toMatchObject({ code: "cose_enc_not_registered" });

      // proprietary allows it, and it still round-trips.
      const encrypted = await aegis.encrypt(claims, {
        format: "cwe",
        key: { encryption: "A128CBC-HS256" },
        proprietary: true,
      });
      const decrypted = await aegis.decrypt(encrypted.token);

      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });
      expect(decrypted.custom).toEqual({ tenant: "acme" });
    });

    test("CweError is the concrete interop-gate error", async () => {
      await expect(
        aegis.encrypt("opaque", {
          format: "cwe",
          key: { encryption: "A128CBC-HS256" },
        }),
      ).rejects.toThrow(CweError);
    });
  });

  // The domain surface must reach ECDH-ES party info (RFC 7518 §4.6) down to
  // `JweKit.encrypt` — previously only `aegis.jwe.encrypt` could set apu/apv.
  describe("ECDH-ES party info (apu/apv) on the domain surface", () => {
    const partyProducer = B64.encode(Buffer.from("producer"), "b64u");
    const partyRecipient = B64.encode(Buffer.from("recipient"), "b64u");

    test("threads partyProducer/partyRecipient to the wire AND the KDF on an ECDH-ES key", async () => {
      const encrypted = await aegis.encrypt(claims, {
        format: "jwe",
        key: { predicate: { id: TEST_EC_KEY_ENC.id } },
        partyProducer,
        partyRecipient,
      });

      // The base64url party info rides the protected header (apu/apv), proving
      // the two params were plumbed through encryptToken → JweKit.encrypt.
      const { header } = JweKit.decodeSegments(encrypted.token);
      expect(header.apu).toBe(partyProducer);
      expect(header.apv).toBe(partyRecipient);

      // A successful round-trip with NON-empty apu/apv proves the KDF consumed
      // them on encrypt: decrypt unconditionally re-derives from the on-wire
      // apu/apv, so a mismatch (KDF ignored on encrypt) would fail the AEAD.
      const decrypted = await aegis.decrypt(encrypted.token);
      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });
      expect(decrypted.custom).toEqual({ tenant: "acme" });
    });

    test("strips party info for a non-ECDH-ES (RSA-OAEP) key — never on the wire", async () => {
      amphora.add(TEST_RSA_KEY_ENC); // scoped here: keeps the default enc-key pool unambiguous elsewhere

      const encrypted = await aegis.encrypt(claims, {
        format: "jwe",
        key: { predicate: { id: TEST_RSA_KEY_ENC.id } },
        partyProducer,
        partyRecipient,
      });

      const { header } = JweKit.decodeSegments(encrypted.token);
      expect(header.apu).toBeUndefined();
      expect(header.apv).toBeUndefined();

      // The token still decrypts — the stripped party info is a no-op.
      const decrypted = await aegis.decrypt(encrypted.token);
      expect(decrypted.claims).toEqual({ subject: "user-1", audience: ["client-1"] });
    });
  });
});
