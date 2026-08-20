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
    // ML-DSA (post-quantum) is asymmetric — a valid COSE_Sign1 key — and now
    // IANA-registered (RFC 9964, ML-DSA-44 = -48). A plain (non-proprietary) CWT
    // sign is accepted and round-trips; no proprietary flag is required. The gate
    // runs inside `signCwt`; the enc-side (AES-CBC-HMAC) gate still covers the
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
 * ⚠ These used to be covered INCIDENTALLY. The claims core signed and verified by
 * constructing `CwsKit`, so `CwsKit.test.ts` drove the structure tag, the
 * reserved-parameter refusal, the two `crit` placement rules and the duplicate
 * rule on behalf of all three signed COSE formats. The claims core composes those
 * utilities itself now — a sibling of the opaque signer rather than a caller of
 * it — so the `cwt` wire owes its own end-to-end evidence: a util test cannot
 * tell which arguments a kit hands it, and `cws` passing says nothing about
 * `cwt`.
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
    // RFC 7515 §4.1.11 puts the duty to understand a critical extension on the
    // RECIPIENT, and a registry entry says nothing about whether the application
    // behind this verify can act on one. So the round trip closes on the
    // declaration, in WIRE vocabulary at a wire door.
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
    // Label 2 is `crit` and label 16 is `typ` (RFC 9052 §3.1 Table 3, RFC 9596
    // §2). `typ` is already in this bucket, so the header stays well-formed and
    // the only fault is the member itself — one RFC 7515 §4.1.11 forbids a
    // producer to name and lets a recipient refuse the token for.
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
 * What matters is HOW the kit says so. The claims verify used to cast the `null`
 * away and hand it to `Buffer.from`, which throws a raw `TypeError` outside the
 * `AegisError` contract, so a caller discriminating on that contract answered a
 * server fault where it should have answered a rejected token. The token costs
 * an attacker nothing: a legal 4-element COSE_Sign1 with a matching `kid` and
 * `alg` clears the kid fail-fast, the typ gates, the arity, the algorithm match
 * and the crit check before reaching the crash. `CwtKit.decode` already answered
 * `cose_malformed` for the same bytes, so the two verbs disagreed about it too.
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
      "The COSE_Sign1 has a detached or nil payload, so there are no CWT claims to verify.",
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
  // ⚠ FLAGGED, NOT FIXED: for an EC key that cycle currently answers with a raw
  // `EcError: Invalid raw signature length` from `@lindorm/ec`, which is NOT an
  // `AegisError` either — the signature cycle's own escape, separate from this
  // guard's. The row pins the boundary this guard owns, not that error.
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

    const thrown = thrownBy(() => kit.verify(empty)) as { code?: string };

    expect(thrown).toBeDefined();
    expect(thrown.code).not.toBe("cose_malformed");
  });
});

/**
 * `cty` is NOT reserved on the claims wire (`KIT_CAPABILITIES.cwt.reserved` is
 * alg/kid/typ), so a caller may relabel the content it mints. That label must
 * not change how the CLAIMS are read.
 *
 * RFC 8392 §7.1 step 2 makes the Message "the binary representation of the CWT
 * Claims Set" and §7.2 verifies that "the Message is a valid CBOR map" — there
 * is no cty-driven decode anywhere in the CWT rules, and `cty` on a CWT signals
 * NESTING (RFC 8392 Appendix A.6), not a parse strategy.
 *
 * Running the verified bytes through the content codec first let the caller's
 * own label decide the parse, so `CwtKit.sign(claims, { header: { cty:
 * "application/json" } })` minted a token its own `verify` could not read —
 * leaking a raw `SyntaxError`, outside the error contract — while
 * `CwtKit.decode` read the same token fine. Two verbs disagreeing about one
 * token, over a label the wire lets any caller set.
 */
describe("CwtKit — a caller cty relabels the content, it does not re-parse the claims", () => {
  const kit = new CwtKit({ logger: createMockLogger(), kryptos: TEST_EC_KEY_SIG });

  // ⚠ The `absent` row expects NO cty on the wire, not an inferred one. RFC 8392
  // §7.2 reads the payload as "a valid CBOR map" with no cty-driven decode, so a
  // claims kit derives none — the parameter exists on this wire to declare
  // NESTING (Appendix A.6), which is precisely what the other three rows do.
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
 * stamps `application/cws`, RFC 9596 §2 makes `typ` the declaration of what the
 * whole COSE object IS, and a COSE object of another shape must not pass as a
 * claims CWT. Signed with the SAME key, so the kid fail-fast is cleared and the
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
    // ⚠ Was "CWT Invalid Typ" — a `cwm` code under a `CWT` title, because this
    // was the last refusal on the claims read path whose title was hardcoded
    // while its code derived from the format. It derives now, both here and on
    // the keyless wire read.
    expect(thrown?.title).toBe("CWM Invalid Typ");
    expect(thrown?.data).toEqual({ typ: "application/cws" });
  });
});
