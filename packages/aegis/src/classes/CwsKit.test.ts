import { EcError } from "@lindorm/ec";
import { KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError, CwsError } from "../errors/index.js";
import { TEST_EC_KEY_SIG } from "../__fixtures__/keys.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { coseByJose } from "../internal/header/header-registry.js";
import {
  COSE_TAG,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { spliceCoseSlot } from "../__fixtures__/splice-cose-slot.js";
import { CwsKit } from "./CwsKit.js";

// The sole opaque COSE signer: it produces a COSE_Sign1 (tag 18) for an
// asymmetric key and a COSE_Mac0 (tag 17) for a symmetric one, gating on the
// key's `algClass` itself.
describe("CwsKit — asymmetric key produces a COSE_Sign1 (tag 18)", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  test("round-trips a payload through sign -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const bytes = kit.sign(payload, { tokenType: "at" });
    const sign1 = decodeCbor<Tag>(bytes);
    expect(sign1.tag).toBe(COSE_TAG.sign1);

    const { payload: out, token } = kit.verify(bytes);
    expect(out.equals(payload)).toBe(true);
    // The result ECHOES the artifact it read. A caller that has to re-emit,
    // forward or cache the token holds the parsed result and nothing else, so an
    // echo that returned a different value — or none — would send it on with an
    // artifact that is not the one it verified.
    expect(token.equals(bytes)).toBe(true);
  });

  test("rejects a tampered payload", () => {
    const sign1 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = sign1.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[3]); // the signature
    tampered[0] ^= 0xff;
    arr[3] = tampered;

    expect(() => kit.verify(encodeCbor(sign1))).toThrow(AegisError);
  });
});

describe("CwsKit — symmetric key produces a COSE_Mac0 (tag 17)", () => {
  const kryptos = KryptosKit.generate.sig.oct({ algorithm: "HS256" });
  const kit = new CwsKit({ kryptos, logger: createMockLogger() });

  test("round-trips a payload through mac -> CBOR -> verify", () => {
    const payload = Buffer.from("the cwt claims bytes");

    const bytes = kit.sign(payload, { tokenType: "at" });
    const mac0 = decodeCbor<Tag>(bytes);
    expect(mac0.tag).toBe(COSE_TAG.mac0);

    const { payload: out, protectedHeader: header } = kit.verify(bytes);
    expect(out.equals(payload)).toBe(true);
    expect(header.alg).toBe("HS256"); // HS256 wire alg name
  });

  test("rejects a tampered payload", () => {
    const mac0 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = mac0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]); // the payload
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    expect(() => kit.verify(encodeCbor(mac0))).toThrow(AegisError);
  });
});

describe("CwsKit — caller-controlled protected / unprotected header bags", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
  const x5u = "https://certs.lindorm.io/leaf.pem";

  const rawMaps = (token: Buffer) => {
    const sign1 = decodeCbor<Tag>(token);
    const [protectedBstr, unprotected] = sign1.contents as [Buffer, Map<number, unknown>];
    return { protectedMap: decodeProtectedHeader(protectedBstr), unprotected };
  };

  test("places caller params protected and the derived routing hint unprotected", () => {
    const token = kit.sign(Buffer.from("claims"), {
      header: { cty: "application/example", x5u },
    });

    // The verify result reports the two buckets SEPARATELY, so a caller can see
    // which of these the signature covers and which it does not.
    const { protectedHeader, unprotectedHeader } = kit.verify(token);
    expect(protectedHeader.cty).toBe("application/example");
    expect(protectedHeader.x5u).toBe(x5u);
    expect(protectedHeader.alg).toBe("ES512");
    expect(unprotectedHeader.kid).toBe(TEST_EC_KEY_SIG.id);
    expect(unprotectedHeader.x5u).toBeUndefined();

    // The raw CBOR maps prove the placement: cty (label 3) + alg (1) + x5u (35)
    // protected; the derived kid (4) unprotected, and nothing else there.
    const { protectedMap, unprotected } = rawMaps(token);
    expect(protectedMap.has(coseByJose("cty"))).toBe(true);
    expect(protectedMap.has(coseByJose("alg"))).toBe(true);
    expect(protectedMap.has(coseByJose("x5u"))).toBe(true);
    expect(unprotected.has(coseByJose("x5u"))).toBe(false);
    expect(unprotected.has(coseByJose("kid"))).toBe(true);
    expect(unprotected.has(coseByJose("cty"))).toBe(false);
  });

  test("tokenType builds the protected typ media type (label 16)", () => {
    const token = kit.sign(Buffer.from("claims"), { tokenType: "at" });
    const { protectedMap } = rawMaps(token);
    expect(protectedMap.get(coseByJose("typ"))).toBe("application/at+cws");
  });

  const codeOf = (fn: () => unknown): string | number | null | undefined => {
    try {
      fn();
    } catch (err) {
      return (err as AegisError).code;
    }
    return undefined;
  };

  test("throws when a derived param (alg) is smuggled into header via an untyped bag", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), { header: { alg: "ES256" } as never }),
      ),
    ).toBe("cose_reserved_header");
  });

  test("throws when a derived param (kid) is smuggled into a custom bag", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), {
          custom: { unprotected: { kid: "other" } },
        }),
      ),
    ).toBe("header_kit_owned_in_custom");
  });

  test("throws when a crit-listed custom param is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), {
          header: { crit: ["x-hint"] },
          custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
        }),
      ),
    ).toBe("cose_crit_param_unprotected");
  });

  test("throws when crit itself is placed unprotected", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), { custom: { unprotected: { crit: ["cty"] } } }),
      ),
    ).toBe("cose_crit_unprotected");
  });

  test("throws when the same custom param is set in both bags", () => {
    expect(
      codeOf(() =>
        kit.sign(Buffer.from("claims"), {
          custom: { protected: { "x-hint": "a" }, unprotected: { "x-hint": "b" } },
        }),
      ),
    ).toBe("cose_duplicate_header");
  });

  // A REGISTERED parameter has no caller-chosen bucket at all: `header` is the
  // one bag that takes one and it travels protected, so `x5u` cannot be written
  // unprotected by any means. Stated on the custom door, which is the only door
  // to that bucket.
  test("throws when a protected-only param is written into a custom bag", () => {
    expect(
      codeOf(() => kit.sign(Buffer.from("claims"), { custom: { unprotected: { x5u } } })),
    ).toBe("header_registered_in_custom");
  });
});

describe("CwsKit — ML-DSA is official COSE (RFC 9964)", () => {
  // ML-DSA (post-quantum, AKP) is IANA-registered (RFC 9964): ML-DSA-44 = -48,
  // ML-DSA-65 = -49, ML-DSA-87 = -50. It is therefore interoperable by default —
  // a plain (non-proprietary) sign is accepted and carries the official label on
  // the wire. The proprietary interop gate fires for no kryptos signing algorithm
  // (every one is official); the AES-CBC-HMAC enc-side gate still exercises that
  // mechanism (see CweKit.test.ts).
  const cases = [
    ["ML-DSA-44", -48],
    ["ML-DSA-65", -49],
    ["ML-DSA-87", -50],
  ] as const;

  test.each(cases)(
    "%s signs interoperably (no proprietary flag) and carries label %s",
    (algorithm, label) => {
      const kryptos = KryptosKit.generate.sig.akp({ algorithm });
      const kit = new CwsKit({ kryptos, logger: createMockLogger() });
      const payload = Buffer.from("the cwt claims bytes");

      const bytes = kit.sign(payload);
      const sign1 = decodeCbor<Tag>(bytes);
      expect(sign1.tag).toBe(COSE_TAG.sign1);

      const protectedHeader = decodeCbor<Map<number, unknown>>(
        (sign1.contents as Array<Buffer>)[0],
      );
      expect(protectedHeader.get(1)).toBe(label);

      const { payload: out } = kit.verify(bytes);
      expect(out.equals(payload)).toBe(true);
    },
  );
});

/**
 * The algorithm-match gate — the tag half of it.
 *
 * The shared `assertAlgorithmMatch` namespaces BOTH the code and the title off
 * the `format` it is handed, and each signed COSE kit hands it its own. Nothing
 * else asserts which tag a kit passes, so the same refusal is driven end to end
 * on each of the three (`cws` here, `cwt` in `CwtKit.test.ts`, `cwm` in
 * `CwmKit.test.ts`).
 */
describe("CwsKit — the algorithm-match gate answers under the cws tag", () => {
  test("refuses a structure whose protected alg is not the configured key's", () => {
    // The gate runs BEFORE the signature cycle, so two unrelated keys suffice —
    // the point is the reported algorithm, not a forged signature.
    const signer = new CwsKit({
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES256" }),
      logger: createMockLogger(),
    });
    const verifier = new CwsKit({
      kryptos: KryptosKit.generate.sig.ec({ algorithm: "ES512" }),
      logger: createMockLogger(),
    });

    const token = signer.sign(Buffer.from("the cwt claims bytes"));

    let thrown: AegisError | undefined;

    try {
      verifier.verify(token);
    } catch (error) {
      thrown = error as AegisError;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect(thrown?.code).toBe("cws_algorithm_mismatch");
    expect(thrown?.title).toBe("CWS Algorithm Mismatch");
    expect(thrown?.data).toEqual({ algorithm: "ES256" });
  });
});

/**
 * A DETACHED (nil) payload — legal COSE (RFC 9052 §4.1), where the content
 * travels out of band and the structure carries `null` in its place.
 *
 * This kit has no out-of-band channel, so such a token is simply not one it can
 * read. What matters is HOW it says so: casting the `null` away and handing it to
 * `Buffer.from` throws a raw `TypeError` — outside the `AegisError` contract
 * entirely. A caller doing `catch (e) { if (e instanceof AegisError) … }` would
 * report a server fault for a token it should reject, and the token is cheap for
 * an attacker to construct: a legal
 * 4-element COSE_Sign1 with a matching `alg` passes the arity, algorithm and
 * crit gates before reaching the crash.
 */
describe("CwsKit — a DETACHED (nil) payload is refused under the error contract", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  // ES512 is COSE label -36 (RFC 9053 §2.1) — spelled here rather than read off
  // the same table the kit reads, so the row states the wire and not itself.
  const detached = (): Buffer =>
    encodeCbor(
      new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
        new Map<number, unknown>([
          [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
        ]),
        null,
        Buffer.alloc(8),
      ]),
    );

  const thrownBy = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return undefined;
  };

  test("verify refuses it as cose_malformed", () => {
    const thrown = thrownBy(() => kit.verify(detached()));

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    // ⚠ THE WORDS, not just the code. `verifyCoseStructure` serves this OPAQUE
    // path and the CLAIMS one from one body and takes the wording as a
    // parameter, declaring it "what tells a reader which door refused them" —
    // a claim nothing checked, so the two arguments could be swapped with the
    // suite green. This is the opaque half; `CwtKit.test.ts` is the claims half.
    expect((thrown as CwsError).details).toBe(
      "The COSE_Sign1 payload slot is not a byte string, so there is no content to verify.",
    );
  });

  test("decode refuses it as cose_malformed", () => {
    const thrown = thrownBy(() => CwsKit.decode(detached()));

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
  });
});

/**
 * A NIL SIGNATURE — the twin escape on the other slot the same structure can
 * leave empty. `arity: { exactly: 4 }` counts ELEMENTS, never four non-nil ones,
 * so a legal 4-element COSE_Sign1 with a matching `alg`, an ATTACHED payload and
 * `null` in slot 4 clears the arity, algorithm and crit gates and reached
 * `Buffer.from(null)` — a raw `TypeError` outside the `AegisError` contract, so a
 * caller discriminating on it answered a server fault for a token it should have
 * rejected. Both verbs did it; the token costs an attacker nothing to build.
 */
describe("CwsKit — a NIL signature is refused under the error contract", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  // ES512 is COSE label -36 (RFC 9053 §2.1) — spelled here rather than read off
  // the same table the kit reads, so the row states the wire and not itself. The
  // payload IS attached: this token gets past the detached-payload guard, and the
  // signature slot is the only thing wrong with it.
  const nilSignature = (): Buffer =>
    encodeCbor(
      new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
        new Map<number, unknown>([
          [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
        ]),
        Buffer.from("the cwt claims bytes"),
        null,
      ]),
    );

  const thrownBy = (fn: () => unknown): unknown => {
    try {
      fn();
    } catch (error) {
      return error;
    }
    return undefined;
  };

  test("verify refuses it as cose_malformed", () => {
    const thrown = thrownBy(() => kit.verify(nilSignature()));
    expect((thrown as CwsError).details).toBe(
      "The COSE_Sign1 signature slot is not a byte string, so there is nothing to verify.",
    );

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
  });

  test("decode refuses it as cose_malformed", () => {
    const thrown = thrownBy(() => CwsKit.decode(nilSignature()));

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
  });

  // One token, one verdict. A `decode` that fabricated `Buffer.alloc(0)` for the
  // missing signature would make the two verbs disagree about the same bytes.
  test("decode and verify AGREE about the token", () => {
    const fromVerify = thrownBy(() => kit.verify(nilSignature())) as CwsError;
    const fromDecode = thrownBy(() => CwsKit.decode(nilSignature())) as CwsError;

    expect(fromVerify).toBeInstanceOf(AegisError);
    expect(fromDecode).toBeInstanceOf(AegisError);
    expect(fromDecode.code).toBe(fromVerify.code);
  });

  // A zero-length signature is PRESENT, not nil: the producer wrote a byte string
  // and it holds no bytes. It must reach the SIGNATURE CYCLE — a different
  // verdict from a malformed structure — or the guard would be rejecting on
  // emptiness rather than on absence, and `decode` must hand the empty signature
  // back as it found it.
  //
  // ⚠ FLAGGED, NOT FIXED: for an EC key that cycle answers `EcError
  // invalid_raw_signature_length` from `@lindorm/ec`, which is NOT an
  // `AegisError` — the signature cycle's own escape, a separate defect from this
  // guard's. Asserted rather than merely "not cose_malformed", so closing that
  // escape reddens this row and names what changed.
  test("an EMPTY signature is a signature — it reaches the signature cycle", () => {
    const empty = encodeCbor(
      new Tag(COSE_TAG.sign1, [
        encodeProtectedHeader(new Map<number, unknown>([[coseByJose("alg"), -36]])),
        new Map<number, unknown>([
          [coseByJose("kid"), Buffer.from(TEST_EC_KEY_SIG.id, "utf8")],
        ]),
        Buffer.from("the cwt claims bytes"),
        Buffer.alloc(0),
      ]),
    );

    const thrown = thrownBy(() => kit.verify(empty));

    expect(thrown).toBeInstanceOf(EcError);
    expect((thrown as EcError).code).toBe("invalid_raw_signature_length");
    expect(CwsKit.decode(empty).signature).toHaveLength(0);
  });
});

// ⛔ A STRUCTURALLY malformed foreign token must be refused as an `AegisError`: a
// consumer branches on it to answer 401, so a raw `TypeError` escaping here is a
// 500 for a token that should simply have been rejected. RFC 9052 §4.2,
// RFC 9052 §6.2.
//
// ⚠ ONE structural fault is OUTSIDE that contract and stays flagged: a signature of
// the WRONG LENGTH is still a byte string, so ANY of them — zero-length, 2 bytes,
// 10 — clears these gates and reaches the signature cycle, which for an EC key
// answers `EcError invalid_raw_signature_length` (pinned by "an EMPTY signature is
// a signature — it reaches the signature cycle" above, which is one instance of the
// class, not its boundary). Closing it needs a length the ALGORITHM knows; a slot
// gate that reaches only the CBOR type cannot state one.
describe("CwsKit — a slot holding something other than a byte string", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
  const CONTENT = Buffer.from("the content bytes");
  const token = kit.sign(CONTENT);

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
        CwsKit.decode(spliceCoseSlot(token, index, value));
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
  // round — a token whose element count is right, told it must be a 4-element
  // array. `split-signed.test.ts` declares its own pair, which pins the plumbing
  // and not the wiring; the wiring exists only here, in `CwsKit.ts` and in
  // `verify-cose-structure.ts`.
  const threeElements = (): Buffer =>
    encodeCbor(
      new Tag(COSE_TAG.sign1, [
        Buffer.alloc(0),
        new Map<number, unknown>(),
        Buffer.from("content"),
      ]),
    );

  test.each([
    [
      "decode names the protected slot",
      () => CwsKit.decode(spliceCoseSlot(token, 0, 42)),
      "The COSE_Sign1/COSE_Mac0 protected header slot is not a byte string, so its parameters cannot be read.",
    ],
    [
      "decode names the arity",
      () => CwsKit.decode(threeElements()),
      "A COSE_Sign1/COSE_Mac0 must be a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
    [
      "decode names the payload slot",
      () => CwsKit.decode(spliceCoseSlot(token, 2, 42)),
      "The COSE_Sign1/COSE_Mac0 payload slot is not a byte string, so there is no content to decode.",
    ],
    [
      "decode names the signature slot",
      () => CwsKit.decode(spliceCoseSlot(token, 3, 42)),
      "The COSE_Sign1/COSE_Mac0 signature/tag slot is not a byte string, so the structure is incomplete.",
    ],
    [
      "verify names the protected slot",
      () => kit.verify(spliceCoseSlot(token, 0, 42)),
      "The COSE_Sign1 protected header slot is not a byte string, so its parameters cannot be read.",
    ],
    [
      "verify names the arity",
      () => kit.verify(threeElements()),
      "A COSE_Sign1 must be a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
  ])("%s", (_name, door, details) => {
    let thrown: unknown;

    try {
      door();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(details);
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
      () => CwsKit.decode(spliceCoseSlot(token, 0, bstr)),
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

  // ⚠ Slot 1 is NOT a byte-string slot — it is the unprotected bucket, and NO
  // signature covers it, so `splitSigned`'s `instanceof Map` narrowing must read
  // an unindexable one as an EMPTY bucket rather than a refusal: the twin of the
  // CWT row in `CwtKit.test.ts`, on the opaque door.
  test.each(NOT_BSTR)(
    "verify still authenticates a token whose unprotected bucket is %s",
    (_name, value) => {
      const { payload, unprotectedHeader } = kit.verify(spliceCoseSlot(token, 1, value));

      expect(payload.equals(CONTENT)).toBe(true);
      expect(unprotectedHeader).toEqual({});
    },
  );

  test("an EMPTY protected header still round-trips — a zero-length bstr is a bstr", () => {
    // RFC 9052 §3. The slot gate is a TYPE check; `encodeProtectedHeader` emits a
    // zero-length byte string for a header map with no parameters, so a non-empty
    // check would refuse a token aegis itself can produce.
    const bare = encodeCbor(
      new Tag(COSE_TAG.sign1, [
        Buffer.alloc(0),
        new Map<number, unknown>(),
        Buffer.from("content"),
        Buffer.from("signature"),
      ]),
    );

    expect(CwsKit.decode(bare).protectedHeader).toEqual({});
  });
});
