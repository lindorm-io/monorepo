import { EcError } from "@lindorm/ec";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import MockDate from "mockdate";
import { beforeEach, describe, expect, test } from "vitest";
import { AegisError, CwmError, CwsError, CwtError } from "../errors/index.js";
import {
  TEST_EC_KEY_SIG,
  TEST_OCT_KEY_SIG,
  TEST_OKP_KEY_SIG,
} from "../__fixtures__/keys.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { COSE_TAG, encodeProtectedHeader } from "../internal/cose/structures.js";
import { coseByJose } from "../internal/header/header-registry.js";
import { spliceCoseSlot } from "../__fixtures__/splice-cose-slot.js";
import { CwmKit } from "./CwmKit.js";
import { CwsKit } from "./CwsKit.js";
import { CwtKit } from "./CwtKit.js";

MockDate.set(new Date("2024-01-01T08:00:00.000Z"));

// The kit is WIRE-ONLY and TRANSFORM-FREE: `sign` serializes an already
// COSE-name-keyed claim dict verbatim; `verify` returns the native WIRE payload
// (`sub`/`cti`, not the domain `subject`/`tokenId`). The domain⇆wire translation
// is Aegis-side (`domainToWire`/`wireToDomain`), never the kit.
const wire = {
  iss: "https://issuer.lindorm.io/",
  sub: "user-1",
  aud: ["https://rs.lindorm.io/"],
  exp: 1704099600, // 2024-01-01T09:00:00Z — future of the mocked 08:00
  iat: 1704092400, // 2024-01-01T06:00:00Z — past
  cti: "the-cti",
  client_id: "client-1",
  scope: ["read", "write"],
};

describe("CwtKit (COSE_Sign1, asymmetric)", () => {
  let kit: CwtKit;

  beforeEach(() => {
    kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });
  });

  test("mints a CWT tagged with the CWT tag (61 = 0xd83d)", () => {
    const token = kit.sign(wire, { tokenType: "at" });
    expect(Buffer.isBuffer(token)).toBe(true);
    // CBOR tag 61 = 0xd8 0x3d
    expect(token.subarray(0, 2).toString("hex")).toBe("d83d");
  });

  test("round-trips the WIRE claims through sign -> verify (no domain translation)", () => {
    const { payload: claims, protectedHeader: header } = kit.verify(
      kit.sign(wire, { tokenType: "at" }),
    );

    // WIRE names only — jose/cose keys, NOT domain (`issuer`/`subject`/`tokenId`).
    expect(claims.iss).toBe("https://issuer.lindorm.io/");
    expect(claims.sub).toBe("user-1");
    expect(claims.aud).toEqual(["https://rs.lindorm.io/"]);
    expect(claims.cti).toBe("the-cti");
    expect(claims.client_id).toBe("client-1");
    expect(claims.scope).toEqual(["read", "write"]);
    // Temporal claims decode to Dates (the codec's "date" kind).
    expect(claims.exp).toEqual(new Date(1704099600 * 1000));
    expect(claims.iat).toEqual(new Date(1704092400 * 1000));
    expect(header.typ).toBe("application/at+cwt");
  });

  test("decode exposes kid / alg / typ without verifying", () => {
    const decoded = CwtKit.decode(kit.sign(wire, { tokenType: "at" }));

    expect(decoded.unprotectedHeader.kid).toBe(TEST_EC_KEY_SIG.id);
    expect(decoded.protectedHeader.alg).toBe("ES512"); // TEST_EC_KEY_SIG is P-521
    expect(decoded.protectedHeader.typ).toBe("application/at+cwt");
  });

  test("rejects a tampered payload", () => {
    const token = kit.sign(wire);
    token[token.length - 5] ^= 0xff; // flip a signature byte
    expect(() => kit.verify(token)).toThrow(AegisError);
  });

  describe("integrity gate — COSE_Sign1 requires an asymmetric key", () => {
    test("throws when handed a symmetric (oct) key", () => {
      expect(
        () => new CwtKit({ logger: createMockLogger(), kryptos: TEST_OCT_KEY_SIG }),
      ).toThrow(AegisError);
    });

    test("the throw carries the cwt_requires_asymmetric_key code", () => {
      const error = (() => {
        try {
          new CwtKit({ logger: createMockLogger(), kryptos: TEST_OCT_KEY_SIG });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("cwt_requires_asymmetric_key");
    });
  });

  test("kid fail-fast — a token naming a different kid throws cwt_kid_mismatch", () => {
    const token = kit.sign(wire);
    const otherKit = new CwtKit({
      logger: createMockLogger(),
      kryptos: TEST_OKP_KEY_SIG, // asymmetric, different id
    });

    const error = (() => {
      try {
        otherKit.verify(token);
      } catch (err) {
        return err as AegisError;
      }
    })();

    expect(error?.code).toBe("cwt_kid_mismatch");
    // The title is derived from the format tag; `CwmKit` asserts its own, which
    // is the pair that says the derivation distinguishes the two structures.
    expect(error?.title).toBe("CWT Kid Mismatch");
  });

  describe("ML-DSA is official COSE (RFC 9964)", () => {
    // ML-DSA (post-quantum) is asymmetric — a valid COSE_Sign1 key — and
    // IANA-registered (RFC 9964, ML-DSA-44 = -48). A plain (non-proprietary) CWT
    // sign is accepted and round-trips; no proprietary flag is required. The gate
    // runs inside `signCwt`; the enc-side (AES-CBC-HMAC) gate covers the
    // proprietary mechanism.
    const mldsa = KryptosKit.generate.sig.akp({ algorithm: "ML-DSA-44" });

    test("non-proprietary sign is accepted and round-trips the WIRE claims", () => {
      const mldsaKit = new CwtKit({ logger: createMockLogger(), kryptos: mldsa });

      const { protectedHeader: header, payload: claims } = mldsaKit.verify(
        mldsaKit.sign(wire, { tokenType: "at" }),
      );

      expect(header.alg).toBe("ML-DSA-44");
      expect(claims.iss).toBe("https://issuer.lindorm.io/");
      expect(claims.cti).toBe("the-cti");
    });
  });

  describe("caller-controlled protected / unprotected header bags", () => {
    test("caller params land protected, the derived routing hint unprotected — reported apart", () => {
      const { protectedHeader, unprotectedHeader } = kit.verify(
        kit.sign(wire, {
          tokenType: "at",
          header: {
            cty: "application/example",
            x5u: "https://certs.lindorm.io/leaf.pem",
          },
        }),
      );

      expect(protectedHeader.cty).toBe("application/example");
      expect(protectedHeader.x5u).toBe("https://certs.lindorm.io/leaf.pem");
      // The always-present derived params are still there.
      expect(protectedHeader.typ).toBe("application/at+cwt");
      expect(protectedHeader.alg).toBe("ES512");

      // The unsigned bucket carries the advisory kid routing hint and nothing
      // the caller put there — RFC 9052 §3.1.
      expect(unprotectedHeader.kid).toBe(TEST_EC_KEY_SIG.id);
      expect(protectedHeader.kid).toBeUndefined();
      expect(unprotectedHeader.cty).toBeUndefined();
    });

    // The caller does NOT choose the bucket for a REGISTERED parameter: `header`
    // is the only bag that takes one and it travels protected. `x5u` written into
    // a custom bag is refused as the misplaced registered parameter it is.
    test("refuses a registered param written into a custom bag", () => {
      const error = (() => {
        try {
          kit.sign(wire, {
            custom: { unprotected: { x5u: "https://certs.lindorm.io/leaf.pem" } },
          });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("header_registered_in_custom");
    });

    test("a derived param (alg) smuggled into the bag throws cose_reserved_header", () => {
      const error = (() => {
        try {
          kit.sign(wire, { header: { alg: "ES256" } as never });
        } catch (err) {
          return err as AegisError;
        }
      })();

      expect(error?.code).toBe("cose_reserved_header");
    });
  });

  describe("temporal-in-kit", () => {
    // The wire kit range-checks exp/nbf/iat against "now" with clock tolerance,
    // validated IF PRESENT — exactly as JwtKit does.
    test("rejects an expired token (exp in the past)", () => {
      const token = kit.sign({ ...wire, exp: 1704092400 }); // 06:00, now is 08:00
      expect(() => kit.verify(token)).toThrow(/Invalid token/);
    });

    test("accepts an expired token within clock tolerance", () => {
      const tolerant = new CwtKit({
        logger: createMockLogger(),
        kryptos: TEST_EC_KEY_SIG,
        clockTolerance: 7200,
      });
      const token = tolerant.sign({ ...wire, exp: 1704092400 });
      expect(() => tolerant.verify(token)).not.toThrow();
    });
  });

  // Temporal overrides — mocked "now" is 2024-01-01T08:00:00Z (unix 1704096000).
  describe("temporal overrides (currentDate / maxTokenAge)", () => {
    test("currentDate overrides now: an expired CWT verifies against a past currentDate", () => {
      // iat 06:00, exp 07:30 — expired against the mocked 08:00 now.
      const token = kit.sign({ ...wire, iat: 1704088800, exp: 1704094200 });
      expect(() => kit.verify(token)).toThrow();

      // Against a currentDate of 07:00 the exp (07:30) is still in the future and
      // the iat (06:00) is still in the past, so the token verifies.
      expect(() =>
        kit.verify(token, undefined, { currentDate: new Date(1704092400 * 1000) }),
      ).not.toThrow();
    });

    test("maxTokenAge accepts a fresh iat and rejects a stale one", () => {
      // iat 60s ago (07:59).
      const fresh = kit.sign({ ...wire, iat: 1704095940, exp: 1704099600 });
      expect(() => kit.verify(fresh, undefined, { maxTokenAge: 300 })).not.toThrow();

      // iat 10 minutes ago (07:50) — older than the 5-minute maxTokenAge.
      const stale = kit.sign({ ...wire, iat: 1704095400, exp: 1704099600 });
      expect(() => kit.verify(stale, undefined, { maxTokenAge: 300 })).toThrow();
    });
  });
});

/**
 * The COSE structure the claims kit builds, and the header rules it enforces
 * while building it.
 *
 * ⚠ THE `cwt` WIRE OWES ITS OWN END-TO-END EVIDENCE. The claims core composes
 * the shared COSE utilities itself — a sibling of the opaque signer rather than a
 * caller of it — and a util test cannot tell which arguments a kit hands it, so
 * `cws` passing says nothing about `cwt`.
 */
describe("CwtKit — the COSE_Sign1 it builds and the header rules it enforces", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  // ⚠ The header refusals below are BYTE-IDENTICAL on `cws`/`cwt`/`cwm` — the
  // code, the title and the details are all the shared util's. The ONE thing
  // that differs per wire is the CLASS, off `ERROR_BY_FORMAT[format]`, so a row
  // asserting the code alone stayed green when the kit's `error:` argument was
  // swapped for `CwsError` — which is precisely the threading this block claims
  // to pin. The error itself is therefore captured, not just its code.
  const thrownBy = (fn: () => unknown): AegisError | undefined => {
    try {
      fn();
    } catch (err) {
      return err as AegisError;
    }
    return undefined;
  };

  test("the structure inside the CWT tag (61) is a COSE_Sign1 (tag 18)", () => {
    // A CWT is a COSE_Sign1 and a CWM a COSE_Mac0 — the STRUCTURE, not the media
    // type, is what tells them apart (both stamp `+cwt`), so a reader that took
    // the typ for the answer would accept a MAC where a signature was required.
    const outer = decodeCbor<Tag>(kit.sign(wire, { tokenType: "at" }));

    expect(outer.tag).toBe(COSE_TAG.cwt);
    expect((outer.contents as Tag).tag).toBe(COSE_TAG.sign1);
  });

  test("refuses a caller typ — it is what routes a COSE token", () => {
    const thrown = thrownBy(() =>
      kit.sign(wire, { header: { typ: "application/x+cwt" } as never }),
    );

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cose_reserved_header");
  });

  test("refuses a derived param (kid) smuggled into a CUSTOM bag", () => {
    const thrown = thrownBy(() =>
      kit.sign(wire, { custom: { unprotected: { kid: "other" } } }),
    );

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("header_kit_owned_in_custom");
  });

  test("refuses crit itself in the unprotected bag (RFC 9052 §3.1)", () => {
    const thrown = thrownBy(() =>
      kit.sign(wire, { custom: { unprotected: { crit: ["cty"] } } }),
    );

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cose_crit_unprotected");
  });

  test("refuses a crit-listed custom param placed unprotected", () => {
    const thrown = thrownBy(() =>
      kit.sign(wire, {
        header: { crit: ["x-hint"] },
        custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
      }),
    );

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cose_crit_param_unprotected");
  });

  test("refuses the same custom param set in BOTH bags", () => {
    const thrown = thrownBy(() =>
      kit.sign(wire, {
        custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
      }),
    );

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cose_duplicate_header");
  });

  test("verify refuses a COSE_Mac0 — the structure the key implies is the only one read", () => {
    // ⚠ Shared id, so the kid fail-fast does not answer first. A symmetric token
    // handed to a Sign1 kit is refused as MALFORMED, before any signature cycle
    // it could never satisfy.
    const id = "key_structure_mismatch_cwt";
    const mac0 = new CwmKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.oct({ algorithm: "HS256", id }),
    }).sign(wire);

    const sign1Kit = new CwtKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES512", id }),
    });

    // ⚠ The refusal is a TRACKED leaf: the structural verdict on the claims
    // verify path is raised under `CwsError`, not the wire's own `CwtError`, so
    // the row asserts the class and the code rather than matching the message —
    // a message regex would survive both a re-worded throw and a re-namespaced
    // one, which is the whole of what there is to pin here.
    const thrown = thrownBy(() => sign1Kit.verify(mac0));

    expect(thrown).toBeInstanceOf(CwsError);
    expect(thrown?.code).toBe("cose_malformed");
  });

  test("verify accepts the crit extension aegis implements once the caller declares it", () => {
    // ⛔ `oid` GETS NO EXCEPTION AT VERIFY. It is the registry's one
    // `critEligible` parameter, which is what lets the MINT gate write it — but
    // the duty to understand a critical extension is the RECIPIENT's
    // (RFC 7515 §4.1.11), and a registry entry says nothing about whether the
    // application behind this verify can act on one. So the round trip closes on
    // the declaration, in WIRE vocabulary at a wire door.
    const token = kit.sign(wire, { header: { crit: ["oid"], oid: "1.2.3.4" } });

    expect(() => kit.verify(token)).toThrow(
      expect.objectContaining({ code: "cwt_unsupported_crit_param" }),
    );

    const verified = kit.verify(token, undefined, { crit: ["oid"] });

    // ⚠ The kit is WIRE-ONLY, so the round trip is asserted in WIRE vocabulary:
    // the member travelled as the label the parameter is keyed under on this wire
    // (RFC 9052 §1.5 — the interoperable default writes `oid`'s private-use label
    // as its text spelling) and comes back as the JOSE wire name, beside the
    // parameter it names. The DOMAIN spelling of the same round trip is the
    // conformance table's business, not the kit's.
    expect(verified.protectedHeader.crit).toEqual(["oid"]);
    expect(verified.protectedHeader.oid).toBe("1.2.3.4");
  });

  test("verify refuses a crit naming a specification-defined parameter, under the cwt tag", () => {
    // The other half, and it needs a FOREIGN header: aegis refuses to MINT a
    // `crit` naming a specification-defined parameter, so the only producer of
    // one is somebody else. The protected bucket is rewritten after the mint —
    // the crit gate runs before the signature cycle, so the broken signature is
    // never reached.
    const token = kit.sign(wire, {});

    let value: unknown = decodeCbor(token);
    const tags: Array<number> = [];
    while (value instanceof Tag) {
      tags.push(Number(value.tag));
      value = value.contents;
    }

    const structure = [...(value as Array<unknown>)];
    const bucket = decodeCbor(structure[0] as Uint8Array) as Map<unknown, unknown>;
    // Label 2 is `crit` and label 16 is `typ` (RFC 9052 §3.1, RFC 9596 §2). `typ`
    // is already in this bucket, so the header stays well-formed and the only
    // fault is the member itself — a specification-defined parameter a producer
    // may not name in `crit` (RFC 7515 §4.1.11).
    //
    // ⚠ An UNREGISTERED text label reaches a DIFFERENT refusal — the unclaimed
    // one (`*_unsupported_crit_param`), or acceptance once the caller declares it
    // (`internal/utils/reject-unknown-critical.ts`) — so it cannot serve as the
    // MALFORMED probe this row needs.
    bucket.set(2, [16]);
    structure[0] = encodeCbor(bucket);

    let wrapped: unknown = structure;
    for (const tag of tags.reverse()) wrapped = new Tag(tag, wrapped);

    let thrown: AegisError | undefined;
    try {
      kit.verify(Buffer.from(encodeCbor(wrapped)));
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwtError);
    // `*_invalid_crit` — `validate-crit.ts` refuses every specification-defined member,
    // which is `rejectUnknownCritical`'s MALFORMED branch.
    expect(thrown?.code).toBe("cwt_invalid_crit");
  });
});

/**
 * The algorithm-match gate under the `cwt` tag.
 *
 * The shared `assertAlgorithmMatch` namespaces the code and the title off the
 * `format` the caller hands it. Driving it end to end is what pins that
 * threading — the util alone cannot tell which tag a kit hands it.
 */
describe("CwtKit — the algorithm-match gate answers under the cwt tag", () => {
  test("refuses a token whose protected alg is not the configured key's", () => {
    // ⚠ The two keys SHARE an id on purpose. The kid fail-fast runs first, so
    // two independently generated keys would answer `cwt_kid_mismatch` and the
    // algorithm gate would never be reached.
    const id = "key_algorithm_match_cwt";

    const signer = new CwtKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES256", id }),
    });
    const verifier = new CwtKit({
      logger: createMockLogger(),
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES512", id }),
    });

    const token = signer.sign(wire, { tokenType: "at" });

    let thrown: AegisError | undefined;

    try {
      verifier.verify(token);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cwt_algorithm_mismatch");
    expect(thrown?.title).toBe("CWT Algorithm Mismatch");
    expect(thrown?.data).toEqual({ algorithm: "ES256" });
  });
});

/**
 * A DETACHED (nil) payload — legal COSE (RFC 9052 §4.1), where the content
 * travels out of band — is not a claims CWT: there are no claims to verify.
 *
 * What matters is HOW the kit says so. Casting the `null` away and handing it to
 * `Buffer.from` throws a raw `TypeError` outside the `AegisError` contract, so a
 * caller discriminating on that contract answers a server fault where it should
 * answer a rejected token. The token costs an attacker nothing: a legal
 * 4-element COSE_Sign1 with a matching `kid` and `alg` clears the kid fail-fast,
 * the typ gates, the arity, the algorithm match and the crit check before
 * reaching the crash. `CwtKit.decode` answers `cose_malformed` for the same
 * bytes, and the two verbs must not disagree about it.
 */
describe("CwtKit — a DETACHED (nil) payload is refused under the error contract", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  // ES512 is COSE label -36 (RFC 9053 §2.1) — spelled here rather than read off
  // the same table the kit reads, so the row states the wire and not itself.
  const detached = encodeCbor(
    new Tag(
      COSE_TAG.cwt,
      new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
        new Map<number, unknown>([
          [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
        ]),
        null,
        Buffer.alloc(8),
      ]),
    ),
  );

  test("verify refuses it as cose_malformed rather than crashing", () => {
    let thrown: unknown;

    try {
      kit.verify(detached);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    // ⚠ THE CLAIMS WORDING — "no CWT claims", where the opaque path says "no
    // content". One shared body (`verifyCoseStructure`) writes both from a
    // parameter, and the parameter is the only thing that differs, so nothing
    // but this and its `CwsKit.test.ts` twin can tell the two apart. Without the
    // pair, swapping the two call sites' arguments left the suite green.
    expect((thrown as CwsError).details).toBe(
      "The COSE_Sign1 payload slot is not a byte string, so there are no CWT claims to verify.",
    );
  });

  test("decode already answered the same way, and still does", () => {
    let thrown: unknown;

    try {
      CwtKit.decode(detached);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as AegisError).code).toBe("cose_malformed");
  });
});

/**
 * A NIL SIGNATURE — the twin of the detached payload, on the other slot the same
 * structure can leave empty. `arity: { exactly: 4 }` counts ELEMENTS, never four
 * non-nil ones, so a legal 4-element COSE_Sign1 with a matching `kid` and `alg`
 * and an ATTACHED claims payload clears every gate and reached
 * `Buffer.from(null)` — a raw `TypeError` outside the `AegisError` contract, so a
 * caller discriminating on it reported a server fault where a rejected token was
 * the answer.
 *
 * `decode` did not crash on these bytes: it fabricated `Buffer.alloc(0)` for the
 * missing signature and returned a token as if it had one — indistinguishable
 * from a real zero-length signature — so the two verbs disagreed about the same
 * token in the other direction. Both refuse it now.
 */
describe("CwtKit — a NIL signature is refused under the error contract", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  // ES512 is COSE label -36 (RFC 9053 §2.1) — spelled here rather than read off
  // the same table the kit reads, so the row states the wire and not itself. The
  // claims payload IS attached (CBOR `{1: "https://issuer.lindorm.io/"}`), so the
  // detached-payload guard is not what answers this token.
  const nilSignature = encodeCbor(
    new Tag(
      COSE_TAG.cwt,
      new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
        new Map<number, unknown>([
          [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
        ]),
        encodeCbor(new Map<number, unknown>([[1, "https://issuer.lindorm.io/"]])),
        null,
      ]),
    ),
  );

  const thrownBy = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return undefined;
  };

  test("verify refuses it as cose_malformed rather than crashing", () => {
    const thrown = thrownBy(() => kit.verify(nilSignature));

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
  });

  test("decode refuses it too, instead of inventing an empty signature", () => {
    const thrown = thrownBy(() => CwtKit.decode(nilSignature));

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as AegisError).code).toBe("cose_malformed");
  });

  // The point of the fix: one token, one verdict — the same agreement the
  // detached-payload rows pin, on the slot that had no guard.
  test("decode and verify AGREE about the token", () => {
    const fromVerify = thrownBy(() => kit.verify(nilSignature)) as AegisError;
    const fromDecode = thrownBy(() => CwtKit.decode(nilSignature)) as AegisError;

    expect(fromVerify).toBeInstanceOf(AegisError);
    expect(fromDecode).toBeInstanceOf(AegisError);
    expect(fromDecode.code).toBe(fromVerify.code);
  });

  // A zero-length signature is PRESENT, not nil — the claims decode must hand it
  // back as it found it, and verify must carry it into the SIGNATURE CYCLE, or
  // the guard would be rejecting emptiness rather than absence.
  //
  // ⚠ FLAGGED, NOT FIXED: for an EC key that cycle answers `EcError
  // invalid_raw_signature_length` from `@lindorm/ec`, which is NOT an
  // `AegisError` — the signature cycle's own escape, separate from this guard's.
  // Asserted rather than merely "not cose_malformed", so closing that escape
  // reddens this row and names what changed.
  test("an EMPTY signature is a signature — decoded as-is, carried to the cycle", () => {
    const empty = encodeCbor(
      new Tag(
        COSE_TAG.cwt,
        new Tag(COSE_TAG.sign1, [
          encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
          new Map<number, unknown>([
            [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
          ]),
          encodeCbor(new Map<number, unknown>([[1, "https://issuer.lindorm.io/"]])),
          Buffer.alloc(0),
        ]),
      ),
    );

    expect(CwtKit.decode(empty).signature).toHaveLength(0);

    const thrown = thrownBy(() => kit.verify(empty));

    expect(thrown).toBeInstanceOf(EcError);
    expect((thrown as EcError).code).toBe("invalid_raw_signature_length");
  });
});

/**
 * `cty` is NOT reserved on the claims wire (`KIT_CAPABILITIES.cwt.reserved` is
 * alg/kid/typ), so a caller may relabel the content it mints. That label must
 * not change how the CLAIMS are read.
 *
 * A CWT's Message is the binary CWT Claims Set, validated as a CBOR map
 * (RFC 8392 §7.1, RFC 8392 §7.2) — there is no cty-driven decode anywhere in the
 * CWT rules, and `cty` on a CWT signals NESTING (RFC 8392 Appendix A.6), not a
 * parse strategy.
 *
 * Running the verified bytes through the content codec first would let the
 * caller's own label decide the parse, so `CwtKit.sign(claims, { header: { cty:
 * "application/json" } })` would mint a token its own `verify` could not read —
 * leaking a raw `SyntaxError`, outside the error contract — while `CwtKit.decode`
 * read the same token fine. Two verbs disagreeing about one token, over a label
 * the wire lets any caller set.
 */
describe("CwtKit — a caller cty relabels the content, it does not re-parse the claims", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  // ⚠ The `absent` row expects NO cty on the wire, not an inferred one. The
  // payload is read as a CBOR map with no cty-driven decode (RFC 8392 §7.2), so a
  // claims kit derives none — the parameter exists on this wire to declare NESTING
  // (RFC 8392 Appendix A.6), which is precisely what the other three rows do.
  const cases: Array<[string, string | undefined, string | undefined]> = [
    ["absent", undefined, undefined],
    ["application/json", "application/json", "application/json"],
    ["text/plain", "text/plain", "text/plain"],
    ["application/cwt", "application/cwt", "application/cwt"],
  ];

  test.each(cases)(
    "round-trips the claims with a %s cty, and carries the label on the wire",
    (_label, cty, expected) => {
      const token = kit.sign(wire, cty === undefined ? {} : { header: { cty } });

      const { payload: claims, protectedHeader } = kit.verify(token);

      expect(claims.iss).toBe("https://issuer.lindorm.io/");
      expect(claims.cti).toBe("the-cti");
      expect(protectedHeader.cty).toBe(expected);
    },
  );

  // The other verb has always read these bytes straight. Asserting the pair
  // together is what pins the two to ONE answer — the disagreement, not merely
  // the crash, was the defect.
  test.each(cases)("decode agrees with verify for a %s cty", (_label, cty) => {
    const token = kit.sign(wire, cty === undefined ? {} : { header: { cty } });

    expect(CwtKit.decode(token).payload.cti).toBe(kit.verify(token).payload.cti);
  });
});

/**
 * A REFUSED verify must leave a trace.
 *
 * Before the claims core became a sibling of the opaque signer it verified by
 * constructing `CwsKit`, and so emitted `"Verifying COSE structure"` from inside
 * that kit. The call is gone; nothing replaced it, so a CWT verify that THREW
 * produced no debug output at all — the one case an operator reads the log for.
 * `JwtKit`, `JwsKit` and `CwsKit` all log at verify entry; this wire does too.
 */
describe("CwtKit — verify logs at entry, so a refusal is traceable", () => {
  test("a refused verify has already emitted the entry line", () => {
    const logs: Array<unknown> = [];
    const kit = new CwtKit({
      logger: createMockLogger((...args: Array<unknown>) => logs.push(args)),
      kryptos: TEST_EC_KEY_SIG,
    });

    const token = kit.sign(wire);
    token[token.length - 5] ^= 0xff; // flip a signature byte

    expect(() => kit.verify(token)).toThrow(AegisError);
    expect(logs.flat()).toContain("Verifying CWT");
  });
});

/**
 * The typ WELL-FORMEDNESS gate under the `cwt` tag — the CALL SITE, which
 * nothing else drives.
 *
 * `assert-wire-typ.test.ts` pins the shared predicate against a config it
 * declares itself, so it stays green over a kit that stopped calling it. Here
 * the token is a REAL foreign COSE object: `CwsKit` signs opaque content and
 * stamps `application/cws`, `typ` declares what the whole COSE object IS
 * (RFC 9596 §2), and a COSE object of another shape must not pass as a claims
 * CWT. Signed with the SAME key, so the kid fail-fast is cleared and the
 * typ is the only thing that refuses it.
 */
describe("CwtKit — the typ gate refuses a COSE object of another shape", () => {
  test("refuses an opaque COSE_Sign1 presented as a CWT", () => {
    const logger = createMockLogger();
    const cws = new CwsKit({ logger, kryptos: TEST_EC_KEY_SIG }).sign(
      Buffer.from("opaque bytes"),
    );

    let thrown: AegisError | undefined;

    try {
      new CwtKit({ logger, kryptos: TEST_EC_KEY_SIG }).verify(cws);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwtError);
    expect(thrown?.code).toBe("cwt_invalid_typ");
    expect(thrown?.title).toBe("CWT Invalid Typ");
    expect(thrown?.data).toEqual({ typ: "application/cws" });
  });
});

/** The COSE_Mac0 twin of the gate above, under the `cwm` tag. */
describe("CwmKit — the typ gate refuses a COSE object of another shape", () => {
  test("refuses an opaque COSE_Mac0 presented as a CWM", () => {
    const logger = createMockLogger();
    const cws = new CwsKit({ logger, kryptos: TEST_OCT_KEY_SIG }).sign(
      Buffer.from("opaque bytes"),
    );

    let thrown: AegisError | undefined;

    try {
      new CwmKit({ logger, kryptos: TEST_OCT_KEY_SIG }).verify(cws);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwmError);
    expect(thrown?.code).toBe("cwm_invalid_typ");
    // ⚠ THE TITLE, not just the code: both derive from the format, so a `cwm`
    // read reports itself as a CWM under either spelling (`verify-cwt.ts`).
    expect(thrown?.title).toBe("CWM Invalid Typ");
    expect(thrown?.data).toEqual({ typ: "application/cws" });
  });
});

// ⛔ A STRUCTURALLY malformed foreign token must be refused as an `AegisError`: a
// consumer branches on it to answer 401, so a raw `TypeError` escaping here is a
// 500 for a token that should simply have been rejected. `verify` opens the
// structure TWICE — the keyless `decodeCwt` view that resolves the key, then
// `verifyCoseStructure` — so both openings have to hold the contract.
//
// ⚠ ONE structural fault is OUTSIDE that contract and stays flagged: a signature of
// the WRONG LENGTH is still a byte string, so ANY of them — zero-length, 2 bytes,
// 10 — clears these gates and reaches the signature cycle, which for an EC key
// answers `EcError invalid_raw_signature_length` (pinned by "an EMPTY signature is
// a signature — decoded as-is, carried to the cycle" above, which is one instance
// of the class, not its boundary). Closing it needs a length the ALGORITHM knows; a
// slot gate that reaches only the CBOR type cannot state one.
describe("CwtKit — a slot holding something other than a byte string", () => {
  const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
  const token = kit.sign(wire);

  const NOT_BSTR: Array<[string, unknown]> = [
    ["nil", null],
    ["an int", 42],
    ["a tstr", "not bytes"],
  ];

  describe.each([
    ["the protected header", 0],
    ["the payload", 2],
    ["the signature", 3],
  ])("%s (slot %i)", (_slot, index) => {
    test.each(NOT_BSTR)("decode refuses %s inside the contract", (_name, value) => {
      let thrown: unknown;

      try {
        CwtKit.decode(spliceCoseSlot(token, index, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    });

    test.each(NOT_BSTR)("verify refuses %s inside the contract", (_name, value) => {
      let thrown: unknown;

      try {
        kit.verify(spliceCoseSlot(token, index, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    });
  });

  // ⚠ THE WORDS, per SLOT. `splitSigned` takes the arity sentence and the slot-0
  // sentence as two separate parameters that share the `cose_malformed` code, so
  // every row above stays green over a call site that wired them the wrong way
  // round — a token whose element count is right, told it does not contain a
  // recognisable COSE structure. `split-signed.test.ts` declares its own pair,
  // which pins the plumbing and not the wiring; on this wire the wiring is in
  // `decode-cwt-wire.ts` (decode) and `decode-cwt.ts` (verify, which opens the
  // structure keylessly first and so refuses slot 0 in its own words).
  test.each([
    [
      "decode names the protected slot",
      () => CwtKit.decode(spliceCoseSlot(token, 0, 42)),
      "The CWT protected header slot is not a byte string, so its parameters cannot be read.",
    ],
    [
      "decode names the arity",
      () =>
        CwtKit.decode(
          encodeCbor(
            new Tag(COSE_TAG.sign1, [Buffer.alloc(0), new Map<number, unknown>()]),
          ),
        ),
      "The CWT does not contain a recognisable COSE structure.",
    ],
    [
      "decode names the payload slot",
      () => CwtKit.decode(spliceCoseSlot(token, 2, 42)),
      "The CWT payload slot is not a byte string, so its claims cannot be decoded.",
    ],
    [
      "decode names the signature slot",
      () => CwtKit.decode(spliceCoseSlot(token, 3, 42)),
      "The CWT signature slot is not a byte string, so the structure is incomplete.",
    ],
    [
      "verify names the protected slot",
      () => kit.verify(spliceCoseSlot(token, 0, 42)),
      "The CWT protected header slot is not a byte string.",
    ],
  ])("%s", (_name, door, details) => {
    let thrown: unknown;

    try {
      door();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(details);
  });

  // ⛔ `requireBstr` reaches only the OUTER byte string of the payload slot; what
  // those bytes must decode to is RFC 8392 §2, RFC 8392 §7.2. The inner half is
  // `decodeCwtMessage`
  // (`cwt-message.ts`), and it guards BOTH failure directions on this pre-verification
  // door — nil escapes the `AegisError` contract as a raw `TypeError` from
  // `Object.entries` (`cwt-claims.ts`), while an array or a tstr is quietly
  // INDEXED into a claims bag (`[1, 2]` reads back as `{ "0": 1, "1": 2 }`) on a
  // token that carries no claims set at all.
  //
  // ⚠ `verify` needs no row: the signature covers the payload, so a rewritten one
  // is refused as `cose_signature_invalid` before the claims are read.
  test.each([
    ["nil", encodeCbor(null)],
    ["an array", encodeCbor([1, 2])],
    ["a tstr", encodeCbor("hi")],
    ["an int", encodeCbor(42)],
    ["a bool", encodeCbor(true)],
  ])("decode refuses a payload byte string holding %s", (_name, bstr) => {
    let thrown: unknown;

    try {
      CwtKit.decode(spliceCoseSlot(token, 2, bstr));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(
      "The CWT payload does not hold a CBOR claims map.",
    );
  });

  // The protected bucket is `bstr .cbor header_map` (RFC 9052 §3) and `requireBstr`
  // reaches only the outer `bstr`. `decodeProtectedHeader` (`structures.ts`) is
  // where the inner half is enforced, and both doors read it.
  test.each([
    ["an int", encodeCbor(42)],
    ["an array", encodeCbor([1, 2])],
    ["nil", encodeCbor(null)],
    ["a tstr", encodeCbor("hi")],
  ])("both doors refuse a protected byte string holding %s", (_name, bstr) => {
    for (const door of [
      () => CwtKit.decode(spliceCoseSlot(token, 0, bstr)),
      () => kit.verify(spliceCoseSlot(token, 0, bstr)),
    ]) {
      let thrown: unknown;

      try {
        door();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    }
  });

  // ⚠ The UNPROTECTED bucket is a map, not a bstr, and NO signature covers it —
  // `decodeCwt` reads the kid hint off it before any key exists. An unindexable
  // bucket is an ABSENT hint, not a refusal, so rewriting it must leave a token
  // this kit's own key verifies exactly as verifiable as it was.
  test.each(NOT_BSTR)(
    "verify still authenticates a token whose unprotected bucket is %s",
    (_name, value) => {
      const { payload } = kit.verify(spliceCoseSlot(token, 1, value));

      expect(payload.sub).toBe(wire.sub);
    },
  );
});

// The COSE_Mac0 twin of the block above — `CwmKit.decode`/`CwmKit.verify` reach the
// SAME `splitSigned`/`decodeCwt`/`verifyCoseStructure` bodies, but each refusal's
// words are built from the structure the KEY implies (`signedCoseStructureTag`), so
// the mac0 half of every templated sentence is unreached by the CWT rows.
describe("CwmKit — a slot holding something other than a byte string", () => {
  const kit = new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger: createMockLogger() });
  const token = kit.sign(wire);

  const NOT_BSTR: Array<[string, unknown]> = [
    ["nil", null],
    ["an int", 42],
    ["a tstr", "not bytes"],
  ];

  describe.each([
    ["the protected header", 0],
    ["the payload", 2],
    ["the authentication tag", 3],
  ])("%s (slot %i)", (_slot, index) => {
    test.each(NOT_BSTR)("decode refuses %s inside the contract", (_name, value) => {
      let thrown: unknown;

      try {
        CwmKit.decode(spliceCoseSlot(token, index, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    });

    test.each(NOT_BSTR)("verify refuses %s inside the contract", (_name, value) => {
      let thrown: unknown;

      try {
        kit.verify(spliceCoseSlot(token, index, value));
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    });
  });

  // ⚠ THE WORDS, per SLOT — the CWM half of the wiring the CWT rows pin. Slot 3 is
  // where the two wires visibly part: `verifyCoseStructure` names it the
  // AUTHENTICATION TAG on a COSE_Mac0 and the SIGNATURE on a COSE_Sign1, off one
  // ternary that only a mac0 row reaches.
  test.each([
    [
      "decode names the protected slot",
      () => CwmKit.decode(spliceCoseSlot(token, 0, 42)),
      "The CWT protected header slot is not a byte string, so its parameters cannot be read.",
    ],
    [
      "decode names the arity",
      () =>
        CwmKit.decode(
          encodeCbor(
            new Tag(COSE_TAG.mac0, [Buffer.alloc(0), new Map<number, unknown>()]),
          ),
        ),
      "The CWT does not contain a recognisable COSE structure.",
    ],
    [
      "verify names the protected slot",
      () => kit.verify(spliceCoseSlot(token, 0, 42)),
      "The CWT protected header slot is not a byte string.",
    ],
    [
      "verify names the payload slot as a COSE_Mac0",
      () => kit.verify(spliceCoseSlot(token, 2, 42)),
      "The COSE_Mac0 payload slot is not a byte string, so there are no CWT claims to verify.",
    ],
    [
      "verify names the authentication tag slot",
      () => kit.verify(spliceCoseSlot(token, 3, 42)),
      "The COSE_Mac0 authentication tag slot is not a byte string, so there is nothing to verify.",
    ],
    [
      "verify names the arity",
      () =>
        kit.verify(
          encodeCbor(
            new Tag(COSE_TAG.mac0, [
              Buffer.alloc(0),
              new Map<number, unknown>(),
              Buffer.from("c"),
            ]),
          ),
        ),
      "A COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
  ])("%s", (_name, door, details) => {
    let thrown: unknown;

    try {
      door();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(details);
  });

  // The CWM half of the claims-set gate — `decodeCwtMessage` is shared, and this is
  // the door that reads it before any key is held. RFC 8392 §2, RFC 8392 §7.2.
  test.each([
    ["nil", encodeCbor(null)],
    ["an array", encodeCbor([1, 2])],
    ["a tstr", encodeCbor("hi")],
  ])("decode refuses a payload byte string holding %s", (_name, bstr) => {
    let thrown: unknown;

    try {
      CwmKit.decode(spliceCoseSlot(token, 2, bstr));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(AegisError);
    expect((thrown as CwsError).details).toBe(
      "The CWT payload does not hold a CBOR claims map.",
    );
  });

  // The inner `bstr .cbor header_map` half (RFC 9052 §3), on the mac0 wire.
  test.each([
    ["an int", encodeCbor(42)],
    ["an array", encodeCbor([1, 2])],
    ["nil", encodeCbor(null)],
    ["a tstr", encodeCbor("hi")],
  ])("both doors refuse a protected byte string holding %s", (_name, bstr) => {
    for (const door of [
      () => CwmKit.decode(spliceCoseSlot(token, 0, bstr)),
      () => kit.verify(spliceCoseSlot(token, 0, bstr)),
    ]) {
      let thrown: unknown;

      try {
        door();
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as CwsError).code).toBe("cose_malformed");
    }
  });

  // ⚠ The UNPROTECTED bucket is a map, not a bstr, and no MAC covers it — an
  // unindexable one is an ABSENT kid hint, not a refusal, so the token stays as
  // verifiable as it was.
  test.each(NOT_BSTR)(
    "verify still authenticates a token whose unprotected bucket is %s",
    (_name, value) => {
      const { payload } = kit.verify(spliceCoseSlot(token, 1, value));

      expect(payload.sub).toBe(wire.sub);
    },
  );
});

/**
 * A CLAIMS SET OF CUSTOM CLAIMS ONLY — a token aegis minted itself.
 *
 * No custom claim carries an integer label, so `preferMap: false` decodes such a
 * Message as a plain OBJECT rather than a `Map`, and `decodeCwtMessage`
 * (`cwt-message.ts`) admits both. The malformed-payload rows above cannot reach
 * that half: every one of them is a refusal.
 */
describe("a CWT whose claims are ALL custom", () => {
  const custom = { alpha: "a", beta: "b" };

  test("CwtKit reads its own all-custom claims back through decode and verify", () => {
    const kit = new CwtKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
    const token = kit.sign(custom);

    expect(CwtKit.decode(token).payload).toEqual(custom);
    expect(kit.verify(token).payload).toEqual(custom);
  });

  test("CwmKit reads its own all-custom claims back through decode and verify", () => {
    const kit = new CwmKit({ kryptos: TEST_OCT_KEY_SIG, logger: createMockLogger() });
    const token = kit.sign(custom);

    expect(CwmKit.decode(token).payload).toEqual(custom);
    expect(kit.verify(token).payload).toEqual(custom);
  });
});
