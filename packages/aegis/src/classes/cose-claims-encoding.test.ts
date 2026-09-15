import { AesKit } from "@lindorm/aes";
import { Amphora } from "@lindorm/amphora";
import { isNumber } from "@lindorm/is";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { Dict } from "@lindorm/types";
import { Tag, decode, encode } from "cbor2";
import MockDate from "mockdate";
import { describe, expect, test } from "vitest";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_ENC,
  TEST_OCT_KEY_SIG,
} from "../__fixtures__/keys.js";
import type { EncryptOptions } from "../types/index.js";
import { Aegis } from "./Aegis.js";
import { CweKit } from "./CweKit.js";
import { CwmKit } from "./CwmKit.js";
import { CwsKit } from "./CwsKit.js";
import { CwtKit } from "./CwtKit.js";

/**
 * ONE CLAIMS ENCODING FOR THE COSE CLAIMS WIRES — AND THE ENCRYPTED WIRE IS NOT
 * ONE OF THEM.
 *
 * A CWT's Message is the binary CWT Claims Set, handed to a COSE_Sign1 or a
 * COSE_Mac0 as its Payload — RFC 8392 §7.1. Those are the wires with an AUTHOR:
 * a claim is a statement
 * someone signed, so the registered integer labels — which tell a conformant
 * reader "this is an issuer" — belong exactly where a signature backs them.
 *
 * ⚠ A COSE_Encrypt0 written by aegis carries NO claims Message: a CWT sealed as
 * a COSE_Encrypt0 (RFC 8392 §7.1) is deliberately not a thing `aegis.encrypt`
 * produces. That verb is pure confidentiality: it seals the value
 * it is handed and returns it unchanged, so it has no authority to promote an
 * arbitrary `{ iss: … }` to label 1, where every conformant COSE reader would
 * take it for an asserted issuer. Sealing a CWT is still available and is what
 * `mint(…, { encrypt })` does — by SIGNING the claims first and sealing the
 * finished token, which is the composition that has an author to point at.
 *
 * ⚠ THE CORPUS CANNOT SEE ANY OF THIS. A COSE_Encrypt0's plaintext is ciphertext
 * on the wire, so a total re-encoding of the claims — every registered claim
 * moved from its integer label to its wire string name — shows up in the frozen
 * corpus as a token-LENGTH delta and nothing else. These rows read the
 * plaintext, which is the only place the encoding is legible.
 *
 * The reader below is INDEPENDENT of `src/internal/`: raw `cbor2` for the
 * structure, the RFC 9052 §5.3 `Enc_structure` spelled out here for the AAD, and
 * `@lindorm/aes` for the AEAD itself. Nothing it asserts is read back from the
 * code that wrote it.
 */

// Inside the fixture keys' validity window — amphora refuses an expired key.
MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

const logger = createMockLogger();

/** RFC 8392 §4, Table 1 — the registered CWT claim keys, as integers. */
const CWT_KEY = { iss: 1, sub: 2, aud: 3, exp: 4, nbf: 5, iat: 6, cti: 7 } as const;

/** RFC 9052 §3.1, Table 2 — the IV travels on label 5 of the unprotected bucket. */
const COSE_IV = 5;

/** A256GCM authentication tag length; the COSE ciphertext is `ct‖tag`. */
const GCM_TAG_BYTES = 16;

/**
 * The claim set both wires carry. COSE-name-keyed WIRE shape, and free of
 * empty/undefined values so the signed path's emission-boundary prune is a no-op
 * and the two payloads are compared on equal terms.
 *
 * `email` is deliberate: it is one of the claims with a PRIVATE-USE COSE label,
 * which is the only kind `proprietary` moves.
 */
const WIRE_CLAIMS: Dict = {
  iss: "https://test.lindorm.io/",
  sub: "user-1",
  aud: "https://api.lindorm.io/",
  email: "user-1@lindorm.io",
  tenant: "acme",
};

const encryptionKey = () =>
  KryptosKit.generate.enc.oct({ algorithm: "dir", encryption: "A256GCM" });

/**
 * Decrypt a bare COSE_Encrypt0 to its RAW PLAINTEXT BYTES, reading the structure
 * with raw `cbor2` and rebuilding the AAD from RFC 9052 §5.3:
 *
 *     Enc_structure = [ context: "Encrypt0", protected: bstr, external_aad: bstr ]
 */
const plaintextOf = (token: Buffer, key: ReturnType<typeof encryptionKey>): Buffer => {
  let value = decode(token);
  while (value instanceof Tag) value = value.contents as unknown;

  const [protectedBstr, unprotected, coseCiphertext] = value as [
    Uint8Array,
    Map<number, unknown>,
    Uint8Array,
  ];

  const iv = unprotected.get(COSE_IV);
  expect(iv).toBeInstanceOf(Uint8Array);

  const aad = Buffer.from(
    encode(["Encrypt0", protectedBstr, new Uint8Array(0)]) as Uint8Array,
  );
  const ct = Buffer.from(coseCiphertext);

  return new AesKit({ kryptos: key }).decryptContent({
    encryption: "A256GCM",
    aad,
    ciphertext: ct.subarray(0, ct.length - GCM_TAG_BYTES),
    iv: Buffer.from(iv as Uint8Array),
    tag: ct.subarray(ct.length - GCM_TAG_BYTES),
  });
};

/** The payload byte string of a bare COSE_Sign1 / COSE_Mac0, read with raw `cbor2`. */
const payloadOf = (token: Buffer): Buffer => {
  let value = decode(token);
  while (value instanceof Tag) value = value.contents as unknown;

  return Buffer.from((value as ReadonlyArray<unknown>)[2] as Uint8Array);
};

/**
 * The plaintext read as the CBOR map it claims to be — labels verbatim.
 * `preferMap` so an integer-labelled map and a string-keyed one are read the same
 * way; a JS object could not hold the integer keys faithfully.
 */
const claimsMapOf = (bytes: Buffer): Map<unknown, unknown> => {
  const decoded = decode(bytes, { preferMap: true });
  expect(decoded).toBeInstanceOf(Map);
  return decoded as Map<unknown, unknown>;
};

/**
 * The plaintext read as the JSON object the shared codec writes for a structured
 * value — the twin of {@link claimsMapOf}. A CWT Message is a CBOR map under
 * integer labels and a sealed object is JSON under text keys, so reading each
 * with the reader that matches it is itself part of the statement.
 */
const opaqueObjectOf = (bytes: Buffer): Dict =>
  JSON.parse(bytes.toString("utf8")) as Dict;

describe("the COSE claims Message is one encoding across the claims wires", () => {
  describe("a signed claim set", () => {
    test("carries the registered claims under their INTEGER labels", () => {
      const map = claimsMapOf(
        payloadOf(new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS)),
      );

      // The whole point: RFC 8392 §4 claim keys, not the wire strings. A reader
      // of this payload that follows RFC 8392 finds an issuer and a subject.
      expect(map.get(CWT_KEY.iss)).toBe(WIRE_CLAIMS.iss);
      expect(map.get(CWT_KEY.sub)).toBe(WIRE_CLAIMS.sub);
      expect(map.get(CWT_KEY.aud)).toBe(WIRE_CLAIMS.aud);

      // …and the string names are GONE, which is the half that fails when the
      // claims are handed to the kit as a generic CBOR object instead.
      expect(map.has("iss")).toBe(false);
      expect(map.has("sub")).toBe(false);
      expect(map.has("aud")).toBe(false);

      // An unregistered claim has no label to take, so it keeps its literal key
      // — the codec's documented passthrough, not an omission.
      expect(map.get("tenant")).toBe(WIRE_CLAIMS.tenant);
    });

    test("is byte-identical between the COSE_Sign1 and the COSE_Mac0", () => {
      const signed = payloadOf(
        new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS),
      );
      const maced = payloadOf(
        new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger }).sign(WIRE_CLAIMS),
      );

      // The load-bearing row. Asserting integer labels on one wire alone would
      // still pass if the two drifted in some other way; equal bytes is the
      // property — one Message, whichever COSE structure carries it.
      // RFC 8392 §7.1.
      expect(signed).toEqual(maced);
    });

    test("moves with `proprietary`, which chooses the private-use label form", () => {
      const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger });

      const interoperable = claimsMapOf(
        payloadOf(kit.sign(WIRE_CLAIMS, { proprietary: false })),
      );
      const onPlatform = claimsMapOf(
        payloadOf(kit.sign(WIRE_CLAIMS, { proprietary: true })),
      );

      // `email` has a private-use COSE label. Interoperable keeps it under the
      // JOSE string key so a conformant reader can still read it; on-platform
      // takes the compact integer. The flag decides digit-vs-string and drops
      // nothing either way.
      expect(interoperable.get("email")).toBe(WIRE_CLAIMS.email);
      expect(onPlatform.has("email")).toBe(false);

      // A Claim Key below -65536 is Private Use (RFC 8392 §9.1.1), which is where
      // every claim aegis labels beyond the registered ones sits.
      const label = [...onPlatform.keys()].find(
        (candidate) => isNumber(candidate) && candidate < -65536,
      );
      expect(label).toBeDefined();
      expect(onPlatform.get(label)).toBe(WIRE_CLAIMS.email);

      // Stated as a byte difference too — inertness is what a difference test
      // catches, and this knob has gone inert once already.
      expect(payloadOf(kit.sign(WIRE_CLAIMS, { proprietary: false }))).not.toEqual(
        payloadOf(kit.sign(WIRE_CLAIMS, { proprietary: true })),
      );
    });
  });

  /**
   * ⛔ THE BOUNDARY: the encrypted wire does not write the Message at all.
   *
   * `aegis.encrypt` seals the caller's value verbatim, so a COSE_Encrypt0 it
   * wrote carries JSON under the caller's own keys — never a CBOR map under
   * RFC 8392's integer labels. The distinction is not cosmetic: label 1 is what
   * tells a conformant reader "this is the issuer", and an encrypt has no
   * signature behind it to make that claim with.
   */
  describe("an encrypted payload of the same shape", () => {
    test("is NOT the signed Message, and carries no integer labels", () => {
      const key = encryptionKey();
      const bytes = plaintextOf(
        new CweKit({ kryptos: key, logger }).encrypt(WIRE_CLAIMS),
        key,
      );

      expect(bytes).not.toEqual(
        payloadOf(new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS)),
      );

      const object = opaqueObjectOf(bytes);

      expect(Object.keys(object)).toEqual(Object.keys(WIRE_CLAIMS));
      expect(Object.keys(object)).not.toContain(String(CWT_KEY.iss));
      expect(Object.keys(object)).not.toContain(String(CWT_KEY.sub));
    });
  });

  describe("an OPAQUE payload of the same shape", () => {
    // ⚠ READ AS JSON, not as CBOR. Every opaque door on both wires uses the
    // `json` family, so the keys below survive in JSON. Serialising a structured
    // value in the CBOR family instead would make an opaque payload
    // indistinguishable from a claims one to a reader.
    test("keeps its literal keys through an encrypted wire", () => {
      const key = encryptionKey();
      const bytes = plaintextOf(
        new CweKit({ kryptos: key, logger }).encrypt(WIRE_CLAIMS),
        key,
      );
      const object = opaqueObjectOf(bytes);

      expect(object.iss).toBe(WIRE_CLAIMS.iss);
      expect(object.email).toBe(WIRE_CLAIMS.email);

      // The keys are the caller's, verbatim and complete — no label mapping
      // happened, in either direction. A JSON object cannot even express the
      // RFC 8392 integer labels, so the stringified form of one is what a
      // regression would leave behind here.
      expect(Object.keys(object)).toEqual(Object.keys(WIRE_CLAIMS));
      expect(Object.keys(object)).not.toContain(String(CWT_KEY.iss));
      expect(Object.keys(object)).not.toContain(String(CWT_KEY.sub));
    });

    test("keeps its literal keys through a signed wire", () => {
      const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger });
      const token = kit.sign(WIRE_CLAIMS);

      // Asserted through the kit's own read, because the opaque signed wire
      // negotiates its own serialisation for a structured value and this row is
      // not about which one it picks — it is about the KEYS surviving it.
      expect(kit.verify<Dict>(token).payload).toEqual(WIRE_CLAIMS);

      // And the bytes are NOT the CWT Message: whatever the opaque codec wrote,
      // it did not write a claims map under RFC 8392 labels.
      expect(payloadOf(token)).not.toEqual(
        payloadOf(new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger }).sign(WIRE_CLAIMS)),
      );
    });
  });

  // The regression this file exists for did not happen in the kit — it happened
  // one layer up, in the domain verb. So the domain verb is asserted on the same
  // bytes, not merely on the kit it delegates to.
  describe("the domain encrypt verb", () => {
    const ISSUER = "https://test.lindorm.io/";
    const CLAIMS = { subject: "user-1", email: "user-1@lindorm.io", tenant: "acme" };

    const domainAegis = async (): Promise<Aegis> => {
      const amphora = new Amphora({ internal: { issuer: ISSUER }, logger });
      await amphora.setup();
      amphora.add(TEST_OCT_KEY_ENC);
      return new Aegis({ amphora, logger });
    };

    const sealedPlaintext = async (options: EncryptOptions): Promise<Buffer> => {
      const { token } = await (await domainAegis()).encrypt(CLAIMS, options);
      return plaintextOf(Buffer.from(token, "base64url"), TEST_OCT_KEY_ENC);
    };

    test("seals the caller's object under the caller's own keys", async () => {
      const object = opaqueObjectOf(await sealedPlaintext({ format: "cwe" }));

      // The domain names the caller wrote — NOT `sub` (the wire spelling of
      // `subject`) and not label 2. Both would mean the verb had translated.
      expect(object).toEqual(CLAIMS);
      expect(Object.keys(object)).not.toContain("sub");
      expect(Object.keys(object)).not.toContain(String(CWT_KEY.sub));
    });

    // `proprietary` still reaches the ENCRYPTION REGISTRATION gate (that is what
    // its knob probe proves, by refusing an unregistered cipher without it); it
    // does not reach a claim codec, because this verb writes no claims. So the
    // plaintext must be identical either way — a difference here would mean the
    // claim codec had found its way back onto this path.
    test("does not let proprietary reach the plaintext at all", async () => {
      const interoperable = await sealedPlaintext({
        format: "cwe",
        proprietary: false,
      });
      const onPlatform = await sealedPlaintext({ format: "cwe", proprietary: true });

      expect(interoperable).toEqual(onPlatform);
      expect(opaqueObjectOf(onPlatform).email).toBe(CLAIMS.email);
    });

    test("leaves an opaque payload opaque", async () => {
      const aegis = await domainAegis();
      const { token } = await aegis.encrypt(Buffer.from("cafe", "utf8"), {
        format: "cwe",
      });

      expect(plaintextOf(Buffer.from(token, "base64url"), TEST_OCT_KEY_ENC)).toEqual(
        Buffer.from("cafe", "utf8"),
      );
    });

    test("round-trips the object back to itself", async () => {
      const aegis = await domainAegis();
      const { token } = await aegis.encrypt(CLAIMS, { format: "cwe" });

      expect((await aegis.decrypt(token)).payload).toEqual(CLAIMS);
    });
  });

  /**
   * THE RAW CWT DOOR BYPASSES DOMAIN TRANSLATION, NOT CBOR SHAPING.
   *
   * `aegis.cwt.sign` takes an ALREADY-WIRE, COSE-name-keyed bag and injects
   * nothing, maps no name and derives no hash (`internal/utils/raw-sign-cwt.ts`).
   * What it does NOT skip is the claim registry's COSE value shaping — the field
   * spec still comes from `CLAIM_SPECS`, so a structured claim handed to this
   * door is written in COSE's own vocabulary rather than JOSE's.
   *
   * ⚠ THIS IS THE DOOR THE SHAPERS' DRIFT GUARDS PROTECT. The DOMAIN mint path
   * throws before an unshapable claim reaches CBOR (`translate.ts`'s
   * `encodeBespoke` ends in its own `never`); this one has no translator in front
   * of it, so a shaper that fell through to an identity codec would put the JOSE
   * shape of a claim onto a signed COSE wire with nothing raised anywhere.
   * `internal/cose/cwt-spec.test.ts` guards both fall-throughs; these rows are
   * the same statement made at the PUBLIC door, where it is a fact about the
   * library rather than about one function.
   *
   * ⚠ TWO shapers, and the rows below split between them. The `cnf`, `act` and
   * `events` rows witness `shapeForBespoke`, which keys off a structured claim's
   * `BespokeKind`. The hash row witnesses `shapeForBstr`, which keys off the
   * per-wire `bstr` codec's `encoding` — a hash is a scalar and never reaches
   * `shapeForBespoke` at all.
   *
   * ⚠ Read with raw `cbor2` (`claimsMapOf`), never back through `aegis.cwt.verify`.
   * An identity ENCODE and an identity DECODE round-trip perfectly, so a
   * round-trip assertion is satisfied by exactly the defect these rows exist to
   * catch.
   */
  describe("the raw CWT door still shapes a structured claim", () => {
    const RAW_ISSUER = "https://test.lindorm.io/";

    const rawAegis = async (): Promise<Aegis> => {
      const amphora = new Amphora({ internal: { issuer: RAW_ISSUER }, logger });
      await amphora.setup();
      amphora.add(TEST_EC_KEY_SIG);
      return new Aegis({ amphora, logger });
    };

    const rawClaimsMap = async (
      claims: Dict,
      proprietary?: boolean,
    ): Promise<Map<unknown, unknown>> => {
      const { token } = await (
        await rawAegis()
      ).cwt.sign(claims, {
        key: { kryptos: TEST_EC_KEY_SIG },
        proprietary,
      });

      return claimsMapOf(payloadOf(Buffer.from(token, "base64url")));
    };

    test("writes `cnf` as a COSE key map under INTEGER members, not the JOSE object", async () => {
      // The `cnf` members carry integer keys — `kid` is 3, valued as a byte
      // string (RFC 8747 §3.1, RFC 8747 §3.4) — and the `cnf` claim key 8 is
      // registered at RFC 8747 §7.1. The JOSE form aegis is handed is a text key
      // with a text value, so the two are distinguishable without asking aegis
      // anything.
      const map = await rawClaimsMap({
        iss: RAW_ISSUER,
        sub: "user-1",
        cnf: { kid: "raw-cnf-kid" },
      });

      const cnf = map.get(8);

      expect(cnf).toBeInstanceOf(Map);
      expect((cnf as Map<unknown, unknown>).get(3)).toEqual(
        Buffer.from("raw-cnf-kid", "utf8"),
      );
      // …and the JOSE spelling is GONE. This is the half that fails when the
      // shaper hands the value through untouched.
      expect((cnf as Map<unknown, unknown>).has("kid")).toBe(false);
    });

    test("writes an OIDC hash as the BYTES its base64url decodes to", async () => {
      // `at_hash` is `kind: "text"` with `per: { cose: { kind: "bstr",
      // encoding: "b64u" } }` — a b64url string on JOSE, the bytes it names on
      // COSE. An identity codec would leave the string.
      const map = await rawClaimsMap({
        iss: RAW_ISSUER,
        sub: "user-1",
        at_hash: "T0RBd01EQXdNREF3TURBd01EQXc",
      });

      expect(map.get("at_hash")).toEqual(
        Buffer.from("T0RBd01EQXdNREF3TURBd01EQXc", "base64url"),
      );
    });

    test("collapses `act` to integer members when the token is on-platform", async () => {
      // The `act` sub-kind switches on `proprietary`, so BOTH halves are asserted
      // — the compact form under it and the interoperable form without it. Either
      // alone is satisfied by a shaper that ignored the option entirely.
      const claims: Dict = {
        iss: RAW_ISSUER,
        sub: "user-1",
        act: { sub: "actor-1", client_id: "actor-client" },
      };

      const interoperable = (await rawClaimsMap(claims, false)).get("act");
      const compact = (await rawClaimsMap(claims, true)).get("act");

      // The actor members are `sub`/`iss`/`client_id` (RFC 8693 §4.1, RFC 8693
      // §4.3); an interoperable token keys them by those strings.
      expect(interoperable).toBeInstanceOf(Map);
      expect((interoperable as Map<unknown, unknown>).get("sub")).toBe("actor-1");
      expect((interoperable as Map<unknown, unknown>).has(2)).toBe(false);

      // On-platform they collapse to the compact integer members — sub=2,
      // client_id=4 — and the string spellings are gone.
      expect(compact).toBeInstanceOf(Map);
      expect((compact as Map<unknown, unknown>).get(2)).toBe("actor-1");
      expect((compact as Map<unknown, unknown>).get(4)).toBe("actor-client");
      expect((compact as Map<unknown, unknown>).has("sub")).toBe(false);
    });

    test("carries `events` verbatim — the sub-kind that has no shaping to do", async () => {
      // The three verbatim sub-kinds are now NAMED arms rather than a
      // fall-through, and naming them must not have changed what they do. An
      // RFC 8417 `events` map is keyed by event-type URI, which is not a field
      // name and has no label to take.
      const map = await rawClaimsMap({
        iss: RAW_ISSUER,
        sub: "user-1",
        events: { "urn:lindorm:event:rtbf": { subject: "user-1" } },
      });

      const events = map.get("events");

      expect(events).toBeInstanceOf(Map);
      expect((events as Map<unknown, unknown>).get("urn:lindorm:event:rtbf")).toEqual(
        new Map([["subject", "user-1"]]),
      );
    });
  });

  describe("the round trip", () => {
    test("leaves an OPAQUE payload's keys alone on the way back", () => {
      const key = encryptionKey();
      const kit = new CweKit({ kryptos: key, logger });

      expect(kit.decrypt<Dict>(kit.encrypt(WIRE_CLAIMS)).payload).toEqual(WIRE_CLAIMS);
    });
  });
});
