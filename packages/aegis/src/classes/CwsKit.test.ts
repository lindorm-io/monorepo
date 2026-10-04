import { type IKryptos, KryptosKit } from "@lindorm/kryptos";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { describe, expect, test } from "vitest";
import { AegisError, CoseError, CwsError } from "../errors/index.js";
import { TEST_EC_KEY_SIG, TEST_OCT_KEY_SIG } from "../__fixtures__/keys.js";
import { foreignSignedCose } from "../__fixtures__/foreign-signed-cose.js";
import { Tag, decodeCbor, encodeCbor } from "../internal/cose/cbor.js";
import { coseByJose } from "../internal/header/header-registry.js";
import {
  COSE_TAG,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "../internal/cose/structures.js";
import { spliceCoseSlot } from "../__fixtures__/splice-cose-slot.js";
import type { CoseLabel } from "../internal/cose/cose-label.js";
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

  test("refuses a tampered signature as a CwsError carrying cose_signature_invalid", () => {
    const sign1 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = sign1.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[3]); // the signature
    tampered[0] ^= 0xff;
    arr[3] = tampered;

    let thrown: unknown;

    try {
      kit.verify(encodeCbor(sign1));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_signature_invalid");
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

  test("refuses a tampered payload as a CwsError carrying cose_mac_invalid", () => {
    const mac0 = decodeCbor<Tag>(kit.sign(Buffer.from("authentic")));
    const arr = mac0.contents as Array<Buffer>;
    const tampered = Buffer.from(arr[2]); // the payload
    tampered[0] ^= 0xff;
    arr[2] = tampered;

    let thrown: unknown;

    try {
      kit.verify(encodeCbor(mac0));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_mac_invalid");
  });
});

describe("CwsKit — caller-controlled protected / unprotected header bags", () => {
  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });
  const x5u = "https://certs.lindorm.io/leaf.pem";

  const rawMaps = (token: Buffer) => {
    const sign1 = decodeCbor<Tag>(token);
    const [protectedBstr, unprotected] = sign1.contents as [Buffer, Map<number, unknown>];
    return { protectedMap: decodeProtectedHeader(protectedBstr, CwsError), unprotected };
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
    // the point is the gate's refusal, not a forged signature.
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
    expect(thrown?.data).toEqual({});
    expect(thrown?.debug).toEqual({ actual: "ES256", expected: "ES512" });
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
  // and it holds no bytes. The slot gate passes it — `decode` hands it back as it
  // found it, or the gate would be rejecting on emptiness rather than on absence —
  // and the SIGNATURE CYCLE refuses its length: the nil slot's code from a
  // different gate, which is why the details are asserted.
  test("an EMPTY signature is a signature — the signature cycle refuses its length as cose_malformed", () => {
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

    expect(thrown).toBeInstanceOf(CwsError);
    expect((thrown as CwsError).code).toBe("cose_malformed");
    expect((thrown as CwsError).details).toBe(
      "The COSE_Sign1 signature is not the length the key's curve defines for an ECDSA signature, so there is nothing to verify.",
    );
    expect(CwsKit.decode(empty).signature).toHaveLength(0);
  });
});

// ⛔ A STRUCTURALLY malformed foreign token must be refused as an `AegisError`: a
// consumer branches on it to answer 401, so a raw `TypeError` escaping here is a
// 500 for a token that should simply have been rejected. RFC 9052 §4.2,
// RFC 9052 §6.2.
//
// A signature of the WRONG LENGTH is a byte string and clears these gates: a slot
// gate reaches only the CBOR type, and the length is the KEY's, refused in the
// signature cycle. pinned: `verify-cose-structure.test.ts`.
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

  // RFC 9052 §4.1, RFC 9052 §5.1.
  const COSE_SIGN_TAG = 98;
  const COSE_ENCRYPT_TAG = 96;

  const fourElementsUnderTag = (tag: number): Buffer =>
    encodeCbor(
      new Tag(tag, [
        Buffer.alloc(0),
        new Map<number, unknown>(),
        Buffer.from("content"),
        [],
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
      "The token is neither a COSE_Sign1 nor a COSE_Mac0, each a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
    [
      "decode names what a 4-element COSE_Sign is not",
      () => CwsKit.decode(fourElementsUnderTag(COSE_SIGN_TAG)),
      "The token is neither a COSE_Sign1 nor a COSE_Mac0, each a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
    [
      "decode names what a 4-element COSE_Encrypt is not",
      () => CwsKit.decode(fourElementsUnderTag(COSE_ENCRYPT_TAG)),
      "The token is neither a COSE_Sign1 nor a COSE_Mac0, each a 4-element array [protected, unprotected, payload, signature/tag].",
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
      "verify names what a 4-element COSE_Sign is not",
      () => kit.verify(fourElementsUnderTag(COSE_SIGN_TAG)),
      "The token is not a COSE_Sign1, which is a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
    [
      "verify names the arity",
      () => kit.verify(threeElements()),
      "The token is not a COSE_Sign1, which is a 4-element array [protected, unprotected, payload, signature/tag].",
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
  ])("both doors refuse a protected byte string holding %s as CwsError", (_, bstr) => {
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

      expect(thrown).toBeInstanceOf(CwsError);
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

// A producer may omit the typ and this door accepts one that does. What it
// refuses is a PRESENT string typ from another family. RFC 9596 §2, RFC 9596 §3.
describe("CwsKit — the protected typ", () => {
  const payload = Buffer.from("the content bytes");

  /**
   * The protected map of a genuine aegis COSE_Sign1/COSE_Mac0, for a foreign
   * producer to re-seal with one cell changed. ⚠ Re-sealing rather than splicing
   * is what lets a token REACH the gate at all — slot 0 is the Sig/MAC structure
   * input, and the gate runs after the signature cycle.
   */
  const foreignProtected = (kit: CwsKit, typ: unknown): Map<CoseLabel, unknown> => {
    const [protectedBstr] = decodeCbor<Tag>(kit.sign(payload, { tokenType: "at" }))
      .contents as [Buffer];
    const map = decodeProtectedHeader(protectedBstr, CwsError);

    if (typ === undefined) map.delete(coseByJose("typ"));
    else map.set(coseByJose("typ"), typ);

    return map;
  };

  // ⚠ THE WORDS, not just the code. `internal/utils/assert-wire-typ.test.ts`
  // enumerates this configuration, but its constants are COPIES that never read
  // production — so only driving the real door catches an edit to what THIS call
  // site passes, which is what a consumer reads.
  const refusalOf = (
    door: () => unknown,
  ): { code?: string; title?: string; details?: string; data?: unknown } => {
    try {
      door();
    } catch (error) {
      return error as { code?: string; title?: string; details?: string; data?: unknown };
    }
    return {};
  };

  describe.each([
    ["COSE_Sign1", TEST_EC_KEY_SIG],
    ["COSE_Mac0", TEST_OCT_KEY_SIG],
  ])("%s", (_structure, kryptos) => {
    const kit = new CwsKit({ kryptos, logger: createMockLogger() });

    test("accepts a token that declares no typ at all", () => {
      const token = foreignSignedCose(kryptos, foreignProtected(kit, undefined), payload);

      expect(kit.verify(token).payload).toEqual(payload);
      expect(kit.verify(token).protectedHeader.typ).toBeUndefined();
    });

    test("refuses a token typed as a claims token", () => {
      const token = foreignSignedCose(
        kryptos,
        foreignProtected(kit, "application/at+cwt"),
        payload,
      );

      const thrown = refusalOf(() => kit.verify(token));

      expect(thrown).toBeInstanceOf(CwsError);
      expect({
        code: thrown.code,
        title: thrown.title,
        details: thrown.details,
        data: thrown.data,
      }).toEqual({
        code: "cws_invalid_typ",
        title: "CWS Invalid Typ",
        details:
          "Header typ must be application/cws or a <type>+cws media type to verify as a COSE_Sign1/COSE_Mac0.",
        data: { typ: "application/at+cwt" },
      });
    });

    // The BARE spellings too, not only the structured `+cwt` one above: the
    // accept list is exact strings, so a bare foreign media type added to it
    // would slip past a suite that only ever presents a suffixed one.
    test.each([["application/cwt"], ["application/cwe"]])(
      "refuses a token typed as the other family's bare media type %s",
      (typ) => {
        const token = foreignSignedCose(kryptos, foreignProtected(kit, typ), payload);

        const thrown = refusalOf(() => kit.verify(token));

        expect(thrown).toBeInstanceOf(CwsError);
        expect({ code: thrown.code, data: thrown.data }).toEqual({
          code: "cws_invalid_typ",
          data: { typ },
        });
      },
    );

    test("refuses a token typed with the JOSE claims-token short name JWT", () => {
      const token = foreignSignedCose(kryptos, foreignProtected(kit, "JWT"), payload);

      const thrown = refusalOf(() => kit.verify(token));

      expect(thrown).toBeInstanceOf(CwsError);
      expect({ code: thrown.code, data: thrown.data }).toEqual({
        code: "cws_invalid_typ",
        data: { typ: "JWT" },
      });
    });

    // The read side reports what a producer WROTE (`normalise-headers.ts` is the
    // write side alone), so an empty text typ reaches the gate as a PRESENT
    // string of no family and is refused, not pruned to absent.
    test("refuses a token whose typ is the empty string", () => {
      const token = foreignSignedCose(kryptos, foreignProtected(kit, ""), payload);

      const thrown = refusalOf(() => kit.verify(token));

      expect(thrown).toBeInstanceOf(CwsError);
      expect({ code: thrown.code, data: thrown.data }).toEqual({
        code: "cws_invalid_typ",
        data: { typ: "" },
      });
    });

    // The two spellings the mint itself writes, both accepted — so the gate cannot
    // refuse aegis's own output. `buildMediaType` produces exactly these.
    test("accepts both spellings the mint writes", () => {
      const prefixed = kit.verify(kit.sign(payload, { tokenType: "at" }));
      expect(prefixed.protectedHeader.typ).toBe("application/at+cws");
      expect(prefixed.payload).toEqual(payload);

      const bare = kit.verify(kit.sign(payload, {}));
      expect(bare.protectedHeader.typ).toBe("application/cws");
      expect(bare.payload).toEqual(payload);
    });
  });

  const kit = new CwsKit({ kryptos: TEST_EC_KEY_SIG, logger: createMockLogger() });

  // AEGIS POLICY, not RFC 9596 §4.1 — the typ row in `header-registry.ts` — in
  // either bucket.
  test.each([
    ["CoAP Content-Format uint", 61],
    ["bstr", Buffer.from("application/at+cwt", "utf8")],
    ["nested array", ["application/at+cwt"]],
    ["nested map", new Map<number, unknown>([[1, "application/at+cwt"]])],
  ])("refuses a token whose typ is a %s", (_shape, typ) => {
    const token = foreignSignedCose(TEST_EC_KEY_SIG, foreignProtected(kit, typ), payload);

    const thrown = refusalOf(() => kit.verify(token));

    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown.code).toBe("cose_header_typ_invalid");
  });

  test("refuses a token whose unprotected typ is a CoAP Content-Format uint", () => {
    const token = spliceCoseSlot(
      foreignSignedCose(TEST_EC_KEY_SIG, foreignProtected(kit, undefined), payload),
      1,
      new Map<CoseLabel, unknown>([[coseByJose("typ"), 61]]),
    );

    const thrown = refusalOf(() => kit.verify(token));

    expect(thrown).toBeInstanceOf(CoseError);
    expect(thrown.code).toBe("cose_header_typ_invalid");
  });

  // The unprotected bucket is covered by nothing, so a text typ there answers
  // nothing: it is reported, and it is not consulted (one that is not text: the
  // rows above). RFC 9596 §2.
  test("does not consult a text typ carried only in the unprotected bucket", () => {
    const token = spliceCoseSlot(
      foreignSignedCose(TEST_EC_KEY_SIG, foreignProtected(kit, undefined), payload),
      1,
      new Map<CoseLabel, unknown>([[coseByJose("typ"), "application/at+cwt"]]),
    );

    const { protectedHeader, unprotectedHeader, payload: out } = kit.verify(token);

    expect(out).toEqual(payload);
    expect(unprotectedHeader.typ).toBe("application/at+cwt");
    expect(protectedHeader.typ).toBeUndefined();
  });

  // The ORDER on THIS door: crit answers before the family typ gate, because that
  // gate sits after `verifyCoseStructure`, which runs crit, the algorithm-match
  // and the signature cycle. `CweKit`, `JwsKit` and the CWT wire answer the
  // family gate first.
  test("answers the crit refusal before the family typ gate for a token failing both", () => {
    const map = foreignProtected(kit, "application/at+cwt");
    map.set(coseByJose("crit"), ["oid"]);
    map.set("oid", "1.2.3");

    expect(() => kit.verify(foreignSignedCose(TEST_EC_KEY_SIG, map, payload))).toThrow(
      expect.objectContaining({ code: "cws_unsupported_crit_param" }),
    );
  });
});

// ⛔ Two routing hints where a reader needs one. The opaque door opens the same
// `splitSigned` structure the claims doors do, so the verdict is theirs
// (`assert-kid-one-bucket.ts`) — aegis policy rather than an RFC 9052 §3
// requirement, and pinned here because this door resolves no key to refuse on.
describe("CwsKit — a key identifier stated in both header buckets", () => {
  const payload = Buffer.from("the content bytes");

  /**
   * The protected map of a genuine aegis token with `kid` ADDED — the fixture
   * writes one unprotected, so the re-sealed token states the hint twice.
   */
  const bothBuckets = (kryptos: IKryptos): Buffer => {
    const kit = new CwsKit({ kryptos, logger: createMockLogger() });
    const [protectedBstr] = decodeCbor<Tag>(kit.sign(payload, { tokenType: "at" }))
      .contents as [Buffer];
    const map = decodeProtectedHeader(protectedBstr, CwsError);

    map.set(coseByJose("kid"), Buffer.from(kryptos.id, "utf8"));

    return foreignSignedCose(kryptos, map, payload);
  };

  test.each([
    ["COSE_Sign1", TEST_EC_KEY_SIG],
    ["COSE_Mac0", TEST_OCT_KEY_SIG],
  ])(
    "CwsKit.decode refuses a %s stating it twice, naming the parameter",
    (_structure, kryptos) => {
      let thrown: AegisError | undefined;

      try {
        CwsKit.decode(bothBuckets(kryptos));
      } catch (error) {
        thrown = error as AegisError;
      }

      expect(thrown).toBeInstanceOf(CwsError);
      expect(thrown?.code).toBe("cose_duplicate_kid");
      expect(thrown?.data).toEqual({ parameter: "kid" });
    },
  );
});

describe("CwsKit — a signed COSE structure the key does not imply", () => {
  test.each([
    [
      "a COSE_Mac0 handed to an asymmetric key",
      TEST_OCT_KEY_SIG,
      TEST_EC_KEY_SIG,
      "The token is not a COSE_Sign1, which is a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
    [
      "a COSE_Sign1 handed to a symmetric key",
      TEST_EC_KEY_SIG,
      TEST_OCT_KEY_SIG,
      "The token is not a COSE_Mac0, which is a 4-element array [protected, unprotected, payload, signature/tag].",
    ],
  ])(
    "verify says what the token is not rather than that its element count is wrong for %s",
    (_name, signer, verifier, details) => {
      const token = new CwsKit({ kryptos: signer, logger: createMockLogger() }).sign(
        Buffer.from("content"),
      );

      let thrown: unknown;

      try {
        new CwsKit({ kryptos: verifier, logger: createMockLogger() }).verify(token);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(AegisError);
      expect((thrown as AegisError).code).toBe("cose_malformed");
      expect((thrown as AegisError).details).toBe(details);
    },
  );
});
