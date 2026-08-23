import { CoseError } from "../../errors/index.js";
import { encodeCbor, decodeCbor } from "./cbor.js";
import type { CoseLabel } from "./cose-label.js";

/** CBOR tags for the COSE structures aegis emits. RFC 9052, RFC 8392. */
export const COSE_TAG = {
  encrypt0: 16,
  mac0: 17,
  sign1: 18,
  cwt: 61,
} as const;

// COSE header parameter labels live in the single header registry
// (`internal/header/header-registry.ts`), resolved via `coseByJose`.

const EMPTY = Buffer.alloc(0);

/**
 * The protected header is a byte string wrapping the deterministically-CBOR-encoded
 * header map. ⚠ An EMPTY one is a zero-length byte string, NOT the encoding of an
 * empty map. RFC 9052 §3.
 */
export const encodeProtectedHeader = (header: Map<CoseLabel, unknown>): Buffer =>
  header.size === 0 ? EMPTY : encodeCbor(header);

/**
 * The protected header as its COSE label map, or the structural refusal.
 *
 * ⚠ NARROWED, NOT CAST. The byte string arrives off a foreign wire and CBOR
 * decodes whatever a producer wrote there, so a declared `Map` return without this
 * check is an unchecked assertion. RFC 9052 §3.
 *
 * ⚠ A ZERO-LENGTH byte string is the empty header map — the encoder above emits
 * exactly that — so it reads as an empty `Map` and never reaches the decode.
 */
export const decodeProtectedHeader = (bstr: Uint8Array): Map<CoseLabel, unknown> => {
  if (bstr.length === 0) return new Map();

  const decoded = decodeCbor<unknown>(bstr);

  if (decoded instanceof Map) return decoded as Map<CoseLabel, unknown>;

  throw new CoseError("Malformed COSE protected header", {
    code: "cose_malformed",
    title: "Malformed COSE Protected Header",
    details: "The protected header byte string does not hold a CBOR map.",
  });
};

/** The to-be-signed bytes for COSE_Sign1 — `Sig_structure`. RFC 9052 §4.4. */
export const buildSigStructure = (
  protectedHeader: Buffer,
  payload: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["Signature1", protectedHeader, externalAad, payload]);

/** The to-be-MAC'd bytes for COSE_Mac0 — `MAC_structure`. RFC 9052 §6.3. */
export const buildMacStructure = (
  protectedHeader: Buffer,
  payload: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["MAC0", protectedHeader, externalAad, payload]);

/**
 * The to-be-secured bytes for ONE signed COSE structure, chosen by its tag. Sign
 * and verify both ask it HERE, so neither carries its own copy of the choice.
 */
export const buildSecuredStructure = (
  tag: typeof COSE_TAG.sign1 | typeof COSE_TAG.mac0,
  protectedHeader: Buffer,
  payload: Buffer,
): Buffer =>
  tag === COSE_TAG.sign1
    ? buildSigStructure(protectedHeader, payload)
    : buildMacStructure(protectedHeader, payload);

/** The AAD for COSE_Encrypt0 — `Enc_structure`, no payload. RFC 9052 §5.3. */
export const buildEncStructure = (
  protectedHeader: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["Encrypt0", protectedHeader, externalAad]);
