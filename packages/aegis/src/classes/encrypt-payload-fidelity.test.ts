import { AesKit } from "@lindorm/aes";
import { Amphora, type IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { Tag, decode, encode } from "cbor2";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_ENC } from "../__fixtures__/keys.js";
import { Aegis } from "./Aegis.js";
import { JweKit } from "./JweKit.js";

/**
 * THE VALUE SEALED IS THE VALUE RETURNED.
 *
 * `aegis.encrypt`/`aegis.decrypt` are a pure CONFIDENTIALITY pair — the
 * `@lindorm/aes` contract, on a token wire. The payload crosses no domain↔wire
 * translation in either direction: an object comes back under the keys its
 * author wrote, a string as a string, a Buffer as those bytes. Headers and
 * options are still domain-translated; the payload is not.
 *
 * ⚠ WHAT THIS FILE REPLACES, AND WHY THE PREDECESSOR WAS WRONG. It used to assert
 * the opposite on one wire and call the difference format-determined: a domain
 * claim set handed to `aegis.encrypt` was translated to wire names, sealed, and
 * translated back, so each wire needed a private cty to recognise its own
 * writing — `application/cbor` for a "claims" COSE_Encrypt0, `application/json`
 * for everything else. On JOSE the line could not be drawn at all (a JWT claims
 * set IS a JSON object), so an opaque `{ iss: … }` sealed through
 * `aegis.jwe.encrypt` was read back as an authenticated-looking issuer claim its
 * author never asserted. The predecessor pinned that as intended behaviour.
 * Decryption establishes confidentiality and says nothing about authorship, so
 * there is no claim to make and nothing to discriminate.
 *
 * ⚠ THE CORPUS IS BLIND HERE — an encrypted payload is ciphertext, and the one
 * time this exact area regressed (every claim key silently re-encoded) the corpus
 * registered a 7-byte length delta and nothing else. So the plaintext is read
 * DIRECTLY below, with a reader independent of `src/internal/`: raw `cbor2` for
 * the COSE structure, the compact segments split by hand for JOSE, the AAD
 * rebuilt from the RFC text in each case, and `@lindorm/aes` for the AEAD.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const ISSUER = "https://test.lindorm.io/";

/** RFC 9052 §3.1, Table 2 — the IV travels on label 5 of the unprotected bucket. */
const COSE_IV = 5;

/** RFC 9052 §3.1, Table 3 — `cty` is label 3 on the COSE wire. */
const COSE_CTY = 3;

/** A256GCM authentication tag length; the COSE ciphertext is `ct‖tag`. */
const GCM_TAG_BYTES = 16;

/** RFC 8392 §4, Table 1 — the registered CWT claim keys, as integers. */
const CWT_KEY = { iss: 1, sub: 2, aud: 3 } as const;

/**
 * An object that deliberately spells its keys BOTH ways a translation could
 * move them: `subject`/`audience` are aegis DOMAIN names whose wire spellings
 * are `sub`/`aud` (JOSE) and labels 2/3 (COSE), and `tenant` is registered
 * nowhere. If either leg translated, the recovered keys would differ.
 */
const OBJECT: Dict = { subject: "user-1", audience: [ISSUER], tenant: "acme" };

/**
 * The other direction of the same hazard: keys that already SPELL registered
 * claims. Nothing about them says their author asserted an issuer.
 */
const CLAIM_SPELLED: Dict = { iss: ISSUER, sub: "user-1", tenant: "acme" };

const OPAQUE_STRING = "an opaque string payload";
const OPAQUE_BYTES = Buffer.from([0xca, 0xfe, 0xba, 0xbe]);

/**
 * Decrypt a base64url COSE_Encrypt0 to its RAW PLAINTEXT BYTES, reading the
 * structure with raw `cbor2` and rebuilding the AAD from RFC 9052 §5.3:
 *
 *     Enc_structure = [ context: "Encrypt0", protected: bstr, external_aad: bstr ]
 */
const cosePlaintextOf = (token: string): Buffer => {
  let value = decode(Buffer.from(token, "base64url"));
  while (value instanceof Tag) value = value.contents as unknown;

  const [protectedBstr, unprotected, coseCiphertext] = value as [
    Uint8Array,
    Map<number, unknown>,
    Uint8Array,
  ];

  const iv = unprotected.get(COSE_IV);
  expect(iv).toBeInstanceOf(Uint8Array);

  // `cbor2`'s encoder BUILDS the AAD; the structure it encodes is spelled out
  // from the RFC above, not read from anything aegis wrote.
  const aad = Buffer.from(
    encode(["Encrypt0", protectedBstr, new Uint8Array(0)]) as Uint8Array,
  );
  const ct = Buffer.from(coseCiphertext);

  return new AesKit({ kryptos: TEST_OCT_KEY_ENC }).decryptContent({
    encryption: "A256GCM",
    aad,
    ciphertext: ct.subarray(0, ct.length - GCM_TAG_BYTES),
    iv: Buffer.from(iv as Uint8Array),
    tag: ct.subarray(ct.length - GCM_TAG_BYTES),
  });
};

/** The protected bucket of a base64url COSE_Encrypt0, read with raw `cbor2`. */
const coseProtectedOf = (token: string): Map<unknown, unknown> => {
  let value = decode(Buffer.from(token, "base64url"));
  while (value instanceof Tag) value = value.contents as unknown;

  const [protectedBstr] = value as [Uint8Array];
  const decoded = decode(Buffer.from(protectedBstr), { preferMap: true });

  expect(decoded).toBeInstanceOf(Map);
  return decoded as Map<unknown, unknown>;
};

/**
 * Decrypt a compact JWE to its RAW PLAINTEXT BYTES. RFC 7516 §7.1 gives the five
 * segments, and §5.1 step 14 gives the AAD: "Let the Additional Authenticated
 * Data encryption parameter be ASCII(BASE64URL(UTF8(JWE Protected Header)))" —
 * i.e. the first segment, verbatim.
 */
const josePlaintextOf = (token: string): Buffer => {
  const [header, encryptedKey, iv, ciphertext, tag] = token.split(".");

  // `dir` (RFC 7518 §4.5): the recipient key IS the content-encryption key, so
  // there is no wrapped CEK.
  expect(encryptedKey).toBe("");

  return new AesKit({ kryptos: TEST_OCT_KEY_ENC }).decryptContent({
    encryption: "A256GCM",
    aad: Buffer.from(header, "ascii"),
    ciphertext: Buffer.from(ciphertext, "base64url"),
    iv: Buffer.from(iv, "base64url"),
    tag: Buffer.from(tag, "base64url"),
  });
};

/** The protected header of a compact JWE, decoded from its first segment. */
const joseProtectedOf = (token: string): Dict =>
  JSON.parse(Buffer.from(token.split(".")[0], "base64url").toString("utf8")) as Dict;

describe("aegis.encrypt / aegis.decrypt — payload fidelity", () => {
  let logger: ILogger;
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_ENC);
    amphora.add(TEST_EC_KEY_SIG);
  });

  // ⭐ THE HEADLINE, stated once per wire. Everything below supports it.
  describe.each(["jwe", "cwe"] as const)("on the %s wire", (format) => {
    test("an object comes back under the caller's own keys", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format });

      expect((await aegis.decrypt(token)).payload).toEqual(OBJECT);
    });

    test("keys that spell registered claims are not promoted to claims", async () => {
      const { token } = await aegis.encrypt(CLAIM_SPELLED, { format });
      const result = await aegis.decrypt(token);

      expect(result.payload).toEqual(CLAIM_SPELLED);
      // The result carries no claim bucket at all — the type has none — so `iss`
      // cannot be reported as a verified issuer by any route.
      expect(Object.keys(result)).not.toContain("claims");
      expect(Object.keys(result)).not.toContain("custom");
    });

    test("a string comes back a string", async () => {
      const { token } = await aegis.encrypt(OPAQUE_STRING, { format });

      expect((await aegis.decrypt(token)).payload).toBe(OPAQUE_STRING);
    });

    test("a Buffer comes back those bytes", async () => {
      const { token } = await aegis.encrypt(OPAQUE_BYTES, { format });

      expect((await aegis.decrypt(token)).payload).toEqual(OPAQUE_BYTES);
    });

    test("the same object seals to the same declaration whatever its keys look like", async () => {
      const domainish = await aegis.encrypt(OBJECT, { format });
      const claimish = await aegis.encrypt(CLAIM_SPELLED, { format });

      const ctyOf =
        format === "jwe"
          ? (token: string) => joseProtectedOf(token).cty
          : (token: string) => coseProtectedOf(token).get(COSE_CTY);

      // One cty for every object, so nothing on the envelope can single one out
      // as "the claims one". This is the deleted discriminant, asserted absent.
      expect(ctyOf(domainish.token)).toBe("application/json");
      expect(ctyOf(claimish.token)).toBe("application/json");
    });
  });

  // DIRECT PROOF OF THE BYTES, because the corpus cannot see them.
  describe("the sealed plaintext, read with an independent reader", () => {
    test("a JWE seals the object as JSON under its own keys", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format: "jwe" });
      const parsed = JSON.parse(josePlaintextOf(token).toString("utf8")) as Dict;

      expect(parsed).toEqual(OBJECT);
      expect(Object.keys(parsed)).toEqual(["subject", "audience", "tenant"]);
      // The JOSE wire spellings of the two registered names are absent — their
      // presence is exactly what `domainToWire` used to produce.
      expect(Object.keys(parsed)).not.toContain("sub");
      expect(Object.keys(parsed)).not.toContain("aud");
    });

    test("a COSE_Encrypt0 seals the object as JSON, with no RFC 8392 labels", async () => {
      const { token } = await aegis.encrypt(OBJECT, { format: "cwe" });
      const bytes = cosePlaintextOf(token);
      const parsed = JSON.parse(bytes.toString("utf8")) as Dict;

      expect(parsed).toEqual(OBJECT);
      expect(Object.keys(parsed)).toEqual(["subject", "audience", "tenant"]);

      // …and the registered INTEGER LABELS are nowhere in it. A JSON object
      // cannot express them, so their stringified form is what a regression to
      // the deleted claims door would leave behind.
      expect(Object.keys(parsed)).not.toContain(String(CWT_KEY.sub));
      expect(Object.keys(parsed)).not.toContain(String(CWT_KEY.aud));
      expect(Object.keys(parsed)).not.toContain(String(CWT_KEY.iss));
    });

    test("a COSE_Encrypt0 seals a string as its utf-8 bytes, not as CBOR", async () => {
      const { token } = await aegis.encrypt(OPAQUE_STRING, { format: "cwe" });

      expect(cosePlaintextOf(token).toString("utf8")).toBe(OPAQUE_STRING);
      expect(coseProtectedOf(token).get(COSE_CTY)).toBe("text/plain");
    });
  });
});

/**
 * ⭐ THE ACCEPTANCE PROPERTY: seal a signed token with the general verb, and the
 * general read verb opens it and checks the inner signature.
 *
 *     aegis.verify(await aegis.encrypt((await aegis.sign(…)).token))
 *
 * It works because the outer DECLARES what its plaintext is. Without that
 * declaration a token sealed by `aegis.encrypt` was still readable — the codec
 * inferred `text/plain` and the string survived — but the emitted token said
 * nothing, so a foreign reader had no way to know it held a token and, for a
 * nested JWT, RFC 7519 §5.2's MUST was violated. `mint(…, { encrypt })` already
 * declared it; the two entry points now resolve the declaration through one
 * table on the wire, so they cannot disagree.
 */
describe("aegis.encrypt over a signed token", () => {
  let amphora: IAmphora;
  let aegis: Aegis;

  beforeEach(async () => {
    const logger = createMockLogger();
    amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
    aegis = new Aegis({ amphora, logger });
    await amphora.setup();
    amphora.add(TEST_OCT_KEY_ENC);
    amphora.add(TEST_EC_KEY_SIG);
  });

  /** One hour past the pinned clock, as a NumericDate. */
  const EXPIRES = Math.floor(new Date("2024-01-01T09:00:00.000Z").getTime() / 1000);

  test("a JWE over a JWS declares application/jose and verifies", async () => {
    const signed = await aegis.sign({ payload: { hello: "world" }, format: "jws" });
    const { token } = await aegis.encrypt(signed.token);

    // RFC 7515 §9.2.1 registers `application/jose` for "a JWS or JWE using the
    // JWS Compact Serialization or the JWE Compact Serialization". It is NOT
    // `JWT`: a JWS carrying arbitrary content is not a JWT, and RFC 7519 §5.2's
    // MUST is scoped to a nested JWT.
    expect(joseProtectedOf(token).cty).toBe("application/jose");

    const verified = await aegis.verify(token);

    expect(verified.format).toBe("jwe");
    expect(verified.inner).toBe("jws");
    expect(verified.raw).toEqual({ hello: "world" });
  });

  test("a JWE over a JWT declares JWT and verifies to the inner claims", async () => {
    const signed = await aegis.jwt.sign({ iss: ISSUER, sub: "user-1", exp: EXPIRES });
    const { token } = await aegis.encrypt(signed.token);

    // RFC 7519 §5.2, verbatim: "In the case that nested signing or encryption is
    // employed, this Header Parameter MUST be present; in this case, the value
    // MUST be "JWT"". The literal, uppercase — §5.2 recommends that spelling.
    expect(joseProtectedOf(token).cty).toBe("JWT");

    const verified = await aegis.verify(token);

    expect(verified.format).toBe("jwe");
    expect(verified.inner).toBe("jwt");
    expect(verified.claims).toMatchObject({ issuer: ISSUER, subject: "user-1" });
  });

  test("a CWE over a CWT declares application/cwt and verifies to the inner claims", async () => {
    const signed = await aegis.cwt.sign({ iss: ISSUER, sub: "user-1", exp: EXPIRES });
    const { token } = await aegis.encrypt(signed.token, { format: "cwe" });

    // RFC 8392 §9.2's registered CWT media type.
    expect(coseProtectedOf(token).get(COSE_CTY)).toBe("application/cwt");

    const verified = await aegis.verify(token);

    expect(verified.format).toBe("cwe");
    expect(verified.inner).toBe("cwt");
    expect(verified.claims).toMatchObject({ issuer: ISSUER, subject: "user-1" });
  });

  /**
   * ⚠ THE OTHER SPELLING, which aegis does not write but must read. RFC 7515
   * §4.1.10 RECOMMENDS omitting the `application/` prefix from a `cty` with no
   * other `/` in it, and requires a recipient to treat the bare form as if the
   * prefix were there. So a conformant foreign producer may seal a JWS under
   * `jose`, and reading that as an opaque blob would lose the token inside.
   */
  test("a foreign JWE declaring the bare `jose` cty still verifies", async () => {
    const signed = await aegis.sign({ payload: { hello: "world" }, format: "jws" });

    // Driven through the kit, because no aegis door writes this spelling.
    const token = new JweKit({
      kryptos: TEST_OCT_KEY_ENC,
      logger: createMockLogger(),
    }).encrypt(signed.token, { header: { cty: "jose" } });

    const verified = await aegis.verify(token);

    expect(verified.inner).toBe("jws");
    expect(verified.raw).toEqual({ hello: "world" });
  });

  /**
   * The two entry points must AGREE, and the only way to state that is to run
   * both and compare the declaration. Byte equality is unavailable — every seal
   * draws a fresh IV — so the envelope's own statement is the comparison.
   */
  test("the profiled mint and the bare encrypt declare the same nesting", async () => {
    const minted = await aegis.mint(
      "id_token",
      { subject: "user-1", audience: ["client-1"] } as never,
      { context: { accessTokenIssued: false }, encrypt: {} } as never,
    );

    const signed = await aegis.jwt.sign({ iss: ISSUER, sub: "user-1", exp: EXPIRES });
    const bare = await aegis.encrypt(signed.token);

    expect(joseProtectedOf(minted.token).cty).toBe(joseProtectedOf(bare.token).cty);
  });

  /**
   * A COSE token's native form is its BYTES, and the outer seals it as such —
   * declaring `application/cwt` over the base64url TEXT would reconstruct to the
   * utf-8 bytes of that text, which the read side would base64url a second time
   * and find no token in. So `decrypt` reports the inner CWT as bytes.
   */
  test("decrypt reports a nested token in its wire's native form", async () => {
    const jose = await aegis.jwt.sign({ iss: ISSUER, sub: "user-1", exp: EXPIRES });
    const jweOuter = await aegis.encrypt(jose.token);

    expect((await aegis.decrypt(jweOuter.token)).payload).toBe(jose.token);

    const cose = await aegis.cwt.sign({ iss: ISSUER, sub: "user-1", exp: EXPIRES });
    const cweOuter = await aegis.encrypt(cose.token, { format: "cwe" });
    const payload = (await aegis.decrypt(cweOuter.token)).payload;

    expect(Buffer.isBuffer(payload)).toBe(true);
    expect((payload as Buffer).toString("base64url")).toBe(cose.token);
  });
});
