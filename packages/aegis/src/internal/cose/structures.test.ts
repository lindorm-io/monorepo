import { describe, expect, test } from "vitest";
import { CoseError } from "../../errors/index.js";
import { decodeCbor, encodeCbor } from "./cbor.js";
import {
  COSE_TAG,
  buildMacStructure,
  buildSecuredStructure,
  buildSigStructure,
  decodeProtectedHeader,
  encodeProtectedHeader,
} from "./structures.js";

const PROTECTED = encodeCbor(new Map<number, unknown>([[1, -7]]));
const PAYLOAD = Buffer.from("the-claims-bytes", "utf8");

/**
 * ⚠ THE TAG→STRUCTURE CHOICE IS ASKED ONCE AND ANSWERED FOR BOTH DIRECTIONS, so
 * no round trip can see it: `CwsKit.sign` and `CwsKit.verify` both call
 * {@link buildSecuredStructure}, and an inverted mapping keeps them in perfect
 * agreement while aegis emits a COSE_Sign1 signed over a `MAC_structure` — a
 * token no conformant verifier accepts. RFC 9052 §4.4, RFC 9052 §6.3.
 */
describe("buildSecuredStructure", () => {
  test("builds the structure its tag names", () => {
    expect(buildSecuredStructure(COSE_TAG.sign1, PROTECTED, PAYLOAD)).toEqual(
      buildSigStructure(PROTECTED, PAYLOAD),
    );
    expect(buildSecuredStructure(COSE_TAG.mac0, PROTECTED, PAYLOAD)).toEqual(
      buildMacStructure(PROTECTED, PAYLOAD),
    );

    // What makes the two rows above non-vacuous: without it, the pair holds for a
    // builder that returns one structure for every tag.
    expect(buildSigStructure(PROTECTED, PAYLOAD)).not.toEqual(
      buildMacStructure(PROTECTED, PAYLOAD),
    );
  });

  // An independent oracle: the context string is a LITERAL, not a second read of
  // the thing under test, so this holds even if both builders were wrong together.
  test("writes the context string the RFC fixes for each structure", () => {
    const signed = decodeCbor<Array<unknown>>(
      buildSecuredStructure(COSE_TAG.sign1, PROTECTED, PAYLOAD),
    );
    const maced = decodeCbor<Array<unknown>>(
      buildSecuredStructure(COSE_TAG.mac0, PROTECTED, PAYLOAD),
    );

    expect(signed[0]).toBe("Signature1");
    expect(maced[0]).toBe("MAC0");
  });

  // RFC 9052 §4.4, RFC 9052 §6.3.
  test("covers the protected header and the payload, with an empty external_aad", () => {
    const structure = decodeCbor<Array<unknown>>(
      buildSecuredStructure(COSE_TAG.sign1, PROTECTED, PAYLOAD),
    );

    expect(structure).toHaveLength(4);
    expect(Buffer.from(structure[1] as Uint8Array)).toEqual(PROTECTED);
    expect(structure[2]).toHaveLength(0);
    expect(Buffer.from(structure[3] as Uint8Array)).toEqual(PAYLOAD);
  });
});

describe("encodeProtectedHeader", () => {
  // RFC 9052 §3. ⚠ Sign and verify use the encoder and decoder symmetrically, so
  // an inversion here round-trips cleanly and shows up only on the wire.
  test("writes an absent protected header as zero bytes, never as an empty map", () => {
    expect(encodeProtectedHeader(new Map())).toHaveLength(0);
    expect(encodeCbor(new Map())).not.toHaveLength(0);
  });

  test("round-trips a populated header and reads zero bytes back as empty", () => {
    expect(decodeProtectedHeader(encodeProtectedHeader(new Map([[1, -7]])))).toEqual(
      new Map([[1, -7]]),
    );
    expect(decodeProtectedHeader(Buffer.alloc(0))).toEqual(new Map());
  });
});

// The protected bucket is `bstr .cbor header_map` (RFC 9052 §3) — TWO conditions,
// and `requireBstr` reaches only the outer one. This is where the inner one is
// enforced, for every reader of the decoded map.
describe("decodeProtectedHeader — the inner `.cbor header_map`", () => {
  test.each([
    ["an int", encodeCbor(42)],
    ["an array", encodeCbor([1, 2])],
    ["nil", encodeCbor(null)],
    ["a tstr", encodeCbor("hi")],
    ["a bool", encodeCbor(true)],
  ])("refuses a byte string holding %s", (_name, bstr) => {
    let thrown: unknown;

    try {
      decodeProtectedHeader(bstr);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(CoseError);
    expect((thrown as CoseError).code).toBe("cose_malformed");
    // THE WORDS. `requireBstr`'s OUTER slot refusal shares this code, so the
    // sentence is the only thing telling the two apart at a call site.
    expect((thrown as CoseError).details).toBe(
      "The protected header byte string does not hold a CBOR map.",
    );
  });

  // ⚠ The gate must not become a CBOR-decode gate: a zero-length byte string is
  // the empty header map, which `encodeProtectedHeader` emits for every aegis
  // token carrying no protected parameter, and it is not valid CBOR on its own.
  test("a ZERO-LENGTH byte string is still the empty map", () => {
    expect(decodeProtectedHeader(Buffer.alloc(0))).toEqual(new Map());
    expect(() => decodeCbor(Buffer.alloc(0))).toThrow();
  });
});
