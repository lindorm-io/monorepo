import { AesKit } from "@lindorm/aes";
import { B64 } from "@lindorm/b64";
import {
  ECDH_ES_ALGORITHMS,
  type EcdhEsAlgorithm,
  type IKryptos,
  type KryptosAlgorithm,
  KryptosKit,
} from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import type { Dict } from "@lindorm/types";
import MockDate from "mockdate";
import {
  TEST_EC_KEY_ENC,
  TEST_OCT_KEY_ENC,
  TEST_OKP_KEY_ENC,
  TEST_RSA_KEY_ENC,
} from "../__fixtures__/keys.js";
import { JweKit } from "./JweKit.js";
import { beforeEach, describe, expect, test } from "vitest";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

/** A five-segment JWE whose header is ours and whose body is junk. */
const craftJwe = (header: Dict): string =>
  [
    Buffer.from(JSON.stringify(header)).toString("base64url"),
    "junk",
    "junk",
    "junk",
    "junk",
  ].join(".");

/** The `code` of the refusal a call produces; a call that does NOT refuse fails. */
const codeOf = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (error) {
    return (error as { code?: string }).code;
  }

  throw new Error("expected a refusal");
};

describe("JweKit", () => {
  let logger: ILogger;
  let kit: JweKit;

  beforeEach(() => {
    logger = createMockLogger();
    kit = new JweKit({ logger, kryptos: TEST_EC_KEY_ENC });
  });

  describe("encrypt", () => {
    test("should encrypt data using EC", () => {
      expect(kit.encrypt("data")).toEqual(expect.any(String));
    });

    test("should encrypt data using OCT", () => {
      kit = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      expect(kit.encrypt("data")).toEqual(expect.any(String));
    });

    test("should encrypt data using OKP", () => {
      kit = new JweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      expect(kit.encrypt("data")).toEqual(expect.any(String));
    });

    test("should encrypt data using RSA", () => {
      kit = new JweKit({ logger, kryptos: TEST_RSA_KEY_ENC });

      expect(kit.encrypt("data")).toEqual(expect.any(String));
    });
  });

  describe("decrypt", () => {
    test("should decrypt data using EC", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "ECDH-ES",
          cty: "text/plain",
          enc: "A256GCM",
          epk: {
            crv: "P-521",
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03",
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT dir", () => {
      kit = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      const token = kit.encrypt("data", {
        header: { oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "dir",
          cty: "text/plain",
          enc: "A256GCM",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "ae26175f-961d-5947-8318-6299e4576b83",
          oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT hkdf", () => {
      const kryptos = KryptosKit.generate.enc.oct({
        algorithm: "A128KW",
        jwksUri: "https://test.lindorm.io/.well-known/jwks.json",
      });

      kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt("data", {
        header: { oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "A128KW",
          cty: "text/plain",
          enc: "A256GCM",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: kryptos.id,
          oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT pbkdf", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "PBES2-HS512+A256KW" });

      kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt("data", {
        header: { oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "PBES2-HS512+A256KW",
          cty: "text/plain",
          enc: "A256GCM",
          kid: kryptos.id,
          oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          p2c: expect.any(Number),
          p2s: expect.any(String),
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OCT A128GCMKW", () => {
      const kryptos = KryptosKit.generate.enc.oct({ algorithm: "A128GCMKW" });

      kit = new JweKit({ logger, kryptos });

      const token = kit.encrypt("data", {
        header: { oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "A128GCMKW",
          cty: "text/plain",
          enc: "A256GCM",
          iv: expect.any(String),
          kid: kryptos.id,
          oid: "19a0c0cc-3eec-4ece-a5a1-4d93a457c3a6",
          tag: expect.any(String),
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using OKP", () => {
      kit = new JweKit({ logger, kryptos: TEST_OKP_KEY_ENC });

      const token = kit.encrypt("data", {
        header: { oid: "540061f3-aea2-4625-b034-c48a7a9ac114" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "ECDH-ES",
          cty: "text/plain",
          enc: "A256GCM",
          epk: {
            crv: "X25519",
            kty: "OKP",
            x: expect.any(String),
          },
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "035f7f00-8101-5387-a935-e92f57347309",
          oid: "540061f3-aea2-4625-b034-c48a7a9ac114",
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });

    test("should decrypt data using RSA", () => {
      kit = new JweKit({ logger, kryptos: TEST_RSA_KEY_ENC });

      const token = kit.encrypt("data", {
        header: { oid: "a152d3f3-4e4b-46ea-ac6f-ae54e0e79090" },
      });

      expect(kit.decrypt(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "RSA-OAEP-256",
          cty: "text/plain",
          enc: "A256GCM",
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "20b09138-bab7-54ce-a491-1f4ba52e3d4e",
          oid: "a152d3f3-4e4b-46ea-ac6f-ae54e0e79090",
          typ: "JWE",
        },
        payload: "data",
        token,
      });
    });
  });

  describe("decode", () => {
    test("should decode data", () => {
      const token = kit.encrypt("data", {
        header: { oid: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99" },
      });

      // decode is encrypted: it exposes only the protected header and the
      // original compact token — never the ciphertext segments.
      expect(JweKit.decode(token)).toEqual({
        unprotectedHeader: {},
        protectedHeader: {
          alg: "ECDH-ES",
          cty: "text/plain",
          enc: "A256GCM",
          epk: {
            crv: "P-521",
            kty: "EC",
            x: expect.any(String),
            y: expect.any(String),
          },
          jku: "https://test.lindorm.io/.well-known/jwks.json",
          kid: "43bd1720-5dab-5d52-ae1e-e9dbbe6adfe4",
          oid: "e5d4ed15-3350-4fdc-a9cf-d8270d637e99",
          typ: "JWE",
        },
        token,
      });
    });
  });

  describe("algorithms", () => {
    const algorithms: Array<KryptosAlgorithm> = [
      "A128GCMKW",
      "A128KW",
      "A192GCMKW",
      "A192KW",
      "A256GCMKW",
      "A256KW",
      "dir",
      "ECDH-ES",
      "ECDH-ES+A128GCMKW",
      "ECDH-ES+A128KW",
      "ECDH-ES+A192GCMKW",
      "ECDH-ES+A192KW",
      "ECDH-ES+A256GCMKW",
      "ECDH-ES+A256KW",
      "PBES2-HS256+A128KW",
      "PBES2-HS384+A192KW",
      "PBES2-HS512+A256KW",
      "RSA-OAEP-256",
      "RSA-OAEP-384",
      "RSA-OAEP-512",
      "RSA-OAEP",
    ];

    // RSA-OAEP-512 generates a 4096-bit RSA key whose runtime varies
    // significantly under CI load (3-10s observed). The default 5s timeout
    // is not enough headroom; bump to 30s for the algorithm sweep.
    test.each(algorithms)(
      "should encrypt and decrypt data using %s",
      (algorithm) => {
        const kryptos = KryptosKit.generate.auto({ algorithm });

        const jweKit = new JweKit({ logger, kryptos });

        const token = jweKit.encrypt("data");

        expect(jweKit.decrypt(token)).toBeDefined();
      },
      30_000,
    );
  });

  describe("critical header parameter rejection", () => {
    test("should reject RFC-valid token with an extension critical parameter aegis does not implement", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      // Well-formed header with a non-registered crit parameter that is
      // present. Aegis should still reject — it doesn't implement any
      // extension parameters.
      const decoded = JweKit.decode(token);
      const headerWithCrit = {
        ...decoded.protectedHeader,
        crit: ["lindorm_ext"],
        lindorm_ext: "some-value",
      };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(
        "Unsupported critical header parameter: lindorm_ext",
      );
    });

    test("should reject malformed crit listing a parameter not present in the header", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.protectedHeader, crit: ["missing_ext"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/not present/);
    });

    test("should reject crit containing an IANA-registered parameter name", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.protectedHeader, crit: ["enc"] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/IANA-registered/);
    });

    test("should reject crit that is an empty array", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      const decoded = JweKit.decode(token);
      const headerWithCrit = { ...decoded.protectedHeader, crit: [] };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithCrit))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(/empty/);
    });

    test("should accept token with empty critical array", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      expect(() => kit.decrypt(token)).not.toThrow();
    });
  });

  describe("zip (compression) rejection", () => {
    test("rejects a JWE with zip: DEF to prevent compression oracle attacks", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      // Splice zip: "DEF" into the protected header to simulate an attacker
      // attempting to compress-then-encrypt. Aegis must reject this outright.
      const decoded = JweKit.decode(token);
      const headerWithZip = { ...decoded.protectedHeader, zip: "DEF" };

      const parts = token.split(".");
      const modifiedHeader = Buffer.from(JSON.stringify(headerWithZip))
        .toString("base64url")
        .replace(/=/g, "");
      const modifiedToken = [modifiedHeader, ...parts.slice(1)].join(".");

      expect(() => kit.decrypt(modifiedToken)).toThrow(
        "Compressed JWE payloads are not supported",
      );
    });
  });

  describe("apu/apv (ECDH-ES party info)", () => {
    const partyProducer = B64.encode(Buffer.from("producer"), "b64u");
    const partyRecipient = B64.encode(Buffer.from("recipient"), "b64u");

    // Every ECDH-ES key-management variant threads apu/apv into the Concat-KDF
    // AND keeps them on the protected header, so the round-trip must succeed and
    // the on-wire apu/apv must survive to the decrypted header.
    test.each(ECDH_ES_ALGORITHMS as ReadonlyArray<EcdhEsAlgorithm>)(
      "should carry partyProducer/partyRecipient through a %s round-trip",
      (algorithm) => {
        const kryptos = KryptosKit.generate.enc.ec({ algorithm });
        const jweKit = new JweKit({ logger, kryptos });

        const token = jweKit.encrypt("data", { partyProducer, partyRecipient });

        // The base64url party info rides the protected header (apu/apv).
        expect(JweKit.decode(token).protectedHeader.apu).toBe(partyProducer);
        expect(JweKit.decode(token).protectedHeader.apv).toBe(partyRecipient);

        const decrypted = jweKit.decrypt(token);
        expect(decrypted.payload).toBe("data");
        expect(decrypted.protectedHeader.apu).toBe(partyProducer);
        expect(decrypted.protectedHeader.apv).toBe(partyRecipient);
      },
    );

    test("should still round-trip an ECDH-ES token WITHOUT party info (KDF apu/apv default empty)", () => {
      const kryptos = KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES" });
      const jweKit = new JweKit({ logger, kryptos });

      const token = jweKit.encrypt("data");

      expect(JweKit.decode(token).protectedHeader.apu).toBeUndefined();
      expect(JweKit.decode(token).protectedHeader.apv).toBeUndefined();
      expect(jweKit.decrypt(token).payload).toBe("data");
    });

    test("should STRIP party info for a non-ECDH-ES algorithm (not on the wire, not in the KDF)", () => {
      // dir (OCT) is not an ECDH-ES algorithm: supplied party info must be
      // dropped — neither emitted on the header nor fed to the key derivation.
      const jweKit = new JweKit({ logger, kryptos: TEST_OCT_KEY_ENC });

      const token = jweKit.encrypt("data", { partyProducer, partyRecipient });

      expect(JweKit.decode(token).protectedHeader.apu).toBeUndefined();
      expect(JweKit.decode(token).protectedHeader.apv).toBeUndefined();

      const decrypted = jweKit.decrypt(token);
      expect(decrypted.payload).toBe("data");
      expect(decrypted.protectedHeader.apu).toBeUndefined();
      expect(decrypted.protectedHeader.apv).toBeUndefined();
    });

    test("should decrypt when the configured partyRecipient matches the token apv", () => {
      const kryptos = KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES" });
      const encryptKit = new JweKit({ logger, kryptos });
      const decryptKit = new JweKit({ logger, kryptos, partyRecipient });

      const token = encryptKit.encrypt("data", { partyProducer, partyRecipient });

      expect(decryptKit.decrypt(token).payload).toBe("data");
    });

    test("should REJECT when the configured partyRecipient does not match the token apv", () => {
      const kryptos = KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES" });
      const encryptKit = new JweKit({ logger, kryptos });
      const decryptKit = new JweKit({
        logger,
        kryptos,
        partyRecipient: B64.encode(Buffer.from("someone-else"), "b64u"),
      });

      const token = encryptKit.encrypt("data", { partyProducer, partyRecipient });

      expect(() => decryptKit.decrypt(token)).toThrow(
        "token not addressed to this recipient",
      );
    });

    test("should REJECT an ECDH-ES token that omits apv when a partyRecipient is configured", () => {
      const kryptos = KryptosKit.generate.enc.ec({ algorithm: "ECDH-ES" });
      const encryptKit = new JweKit({ logger, kryptos });
      const decryptKit = new JweKit({ logger, kryptos, partyRecipient });

      const token = encryptKit.encrypt("data");

      expect(() => decryptKit.decrypt(token)).toThrow(
        "token not addressed to this recipient",
      );
    });
  });

  describe("tokenType round-trip", () => {
    test("should surface tokenType on decrypted header when signed with it", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
        tokenType: "logout_token",
      });

      const decrypted = kit.decrypt(token);

      expect(decrypted.protectedHeader.typ).toBe("application/logout_token+jwe");
    });

    test("should surface erasure_token on decrypted header when signed with it", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
        tokenType: "erasure_token",
      });

      const decrypted = kit.decrypt(token);

      expect(decrypted.protectedHeader.typ).toBe("application/erasure_token+jwe");
    });

    test("should leave tokenType undefined when not supplied", () => {
      const token = kit.encrypt("data", {
        header: { oid: "5b63e7ec-5ca4-4083-8de9-de0d6e2ddd03" },
      });

      const decrypted = kit.decrypt(token);

      expect(decrypted.protectedHeader.typ).toBe("JWE");
    });
  });

  /**
   * The two header gates `decrypt` runs BEFORE any AEAD — so a crafted token is
   * enough to reach them, and a crafted token is the only way to reach them at
   * all: `encrypt` can emit neither a typ-less JWE nor a mismatched alg.
   */
  describe("the pre-AEAD header gates", () => {
    let kwKit: JweKit;

    beforeEach(() => {
      kwKit = new JweKit({
        logger,
        kryptos: KryptosKit.generate.enc.oct({
          algorithm: "A256KW",
          encryption: "A256GCM",
        }),
      });
    });

    describe("typ presence — REQUIRED on this wire alone", () => {
      test("⚠ refuses a typ-LESS JWE, where JWT/JWS/CWT accept one", () => {
        // This is what `presence: "required"` at the call site buys, and the
        // ONLY thing that asserts it end to end. RFC 7516 leaves typ optional;
        // requiring it here is aegis policy, so nothing but this test stops the
        // call site being relaxed to "optional".
        expect(
          codeOf(() => kwKit.decrypt(craftJwe({ alg: "A256KW", enc: "A256GCM" }))),
        ).toBe("jwe_invalid_typ");
      });

      test("refuses a typ from another family", () => {
        expect(
          codeOf(() =>
            kwKit.decrypt(craftJwe({ alg: "A256KW", enc: "A256GCM", typ: "JWT" })),
          ),
        ).toBe("jwe_invalid_typ");
      });

      test("a JWE typ passes the gate — the refusals above are the typ's doing", () => {
        // Same crafted token, same junk body: with a JWE typ the read gets PAST
        // the typ gate and fails on the junk instead. Without this the two rows
        // above would also pass if the gate refused everything.
        expect(
          codeOf(() =>
            kwKit.decrypt(craftJwe({ alg: "A256KW", enc: "A256GCM", typ: "JWE" })),
          ),
        ).not.toBe("jwe_invalid_typ");
      });
    });

    test("⚠ an algorithm mismatch reports the offending value under `alg`", () => {
      // This wire answers with `data: { alg }`; JWT/JWS/CWT answer with
      // `data: { algorithm }`. The difference is a deliberate override at the
      // call site, and `data` is a consumer-facing contract — so the key is
      // asserted exactly, not merely its value.
      let thrown: { code?: string; data?: unknown } = {};

      try {
        kwKit.decrypt(craftJwe({ alg: "A128KW", enc: "A256GCM", typ: "JWE" }));
      } catch (error) {
        thrown = error as typeof thrown;
      }

      expect(thrown.code).toBe("jwe_algorithm_mismatch");
      expect(thrown.data).toEqual({ alg: "A128KW" });
    });
  });

  /**
   * The read-side ECDH-ES gate — `resolveEcdhParty` at the `decrypt` call site,
   * which hands the AES layer `apu`/`apv` for an ECDH-ES algorithm and
   * `undefined` for every other one. It carries TWO separate claims, and they
   * are provable in different places.
   *
   * 1. The party info a non-ECDH-ES token carries CHANGES NOTHING: that key
   *    derivation reads neither field, so stripping them cannot change a
   *    plaintext. That is a claim about `@lindorm/aes`, so it is asserted
   *    against the AES layer directly (the rows below).
   * 2. Stripping means a malformed apu is never DECODED at all. That IS
   *    provable by forging, and the first test does it.
   */
  describe("apu/apv reach no non-ECDH-ES key derivation", () => {
    const apu = Buffer.from("producer", "utf8");
    const apv = Buffer.from("recipient", "utf8");

    test("⚠ a MALFORMED apu on a non-ECDH-ES token refuses, it does not crash", () => {
      // `resolveEcdhParty` decodes with `B64.toBuffer`, which is
      // `Uint8Array.fromBase64` with no guard (`@lindorm/b64`
      // `internal/decode.ts`) — a non-base64 string throws a raw `SyntaxError`.
      // Nothing between the wire and that call inspects `apu`: `decodeJoseHeader`
      // validates only `alg`/`enc`, the header registry types `apu` as a plain
      // string, and `parseTokenHeader` copies it verbatim. So the ALGORITHM gate
      // is the only thing standing between a crafted header and a `SyntaxError`
      // escaping `decrypt` — with it, `apu` is stripped, never decoded, and the
      // read fails in the AES layer under a proper aegis error code instead.
      const kwKit = new JweKit({
        logger,
        kryptos: KryptosKit.generate.enc.oct({
          algorithm: "A256KW",
          encryption: "A256GCM",
        }),
      });

      let thrown: unknown;

      try {
        kwKit.decrypt(
          craftJwe({ typ: "JWE", alg: "A256KW", enc: "A256GCM", apu: "!!!" }),
        );
      } catch (error) {
        thrown = error;
      }

      expect(thrown).not.toBeInstanceOf(SyntaxError);
      expect(thrown).toEqual(expect.objectContaining({ code: "decryption_failed" }));
    });

    const NON_ECDH_KEYS: Array<[KryptosAlgorithm, IKryptos]> = [
      ["dir", KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" })],
      [
        "A256KW",
        KryptosKit.generate.enc.oct({ algorithm: "A256KW", encryption: "A256GCM" }),
      ],
      [
        "RSA-OAEP",
        KryptosKit.generate.enc.rsa({ algorithm: "RSA-OAEP", encryption: "A256GCM" }),
      ],
    ];

    // ⚠ The three rows below and their control drive `@lindorm/aes` directly, not
    // JweKit — they assert an `@lindorm/aes` invariant, and belong in that
    // package's suite. They live here only because that package is frozen; move
    // them when it is unfrozen.
    test.each(NON_ECDH_KEYS)(
      "%s decrypts identically with the party info present and absent",
      (_algorithm, kryptos) => {
        const aes = new AesKit({ kryptos });
        const record = aes.encrypt("data", "record", { apu, apv });

        expect(aes.decrypt({ ...record, apu, apv })).toBe("data");
        expect(aes.decrypt({ ...record, apu: undefined, apv: undefined })).toBe("data");
      },
    );

    test("⚠ CONTROL — ECDH-ES does NOT decrypt identically, so the probe can see", () => {
      // Without this the rows above would pass even if the probe were blind to
      // apu/apv altogether. The Concat-KDF (RFC 7518 §4.6) consumes both, so
      // dropping them derives a different CEK and the AEAD refuses.
      //
      // ⚠ It refuses with the AEAD's OWN verdict, asserted by code: a bare
      // `.toThrow()` here would be satisfied by any unrelated ECDH-ES breakage
      // just as well as by a diverged CEK, and this control is the only thing
      // keeping the inert rows above non-vacuous.
      const aes = new AesKit({
        kryptos: KryptosKit.generate.enc.ec({
          algorithm: "ECDH-ES",
          encryption: "A256GCM",
        }),
      });
      const record = aes.encrypt("data", "record", { apu, apv });

      expect(aes.decrypt({ ...record, apu, apv })).toBe("data");
      expect(
        codeOf(() => aes.decrypt({ ...record, apu: undefined, apv: undefined })),
      ).toBe("decryption_failed");
    });
  });
});
