import { encodeCbor, decodeCbor } from "./cbor.js";

/** CBOR tags for the COSE structures we emit (RFC 9052 / RFC 8392). */
export const COSE_TAG = {
  encrypt0: 16,
  mac0: 17,
  sign1: 18,
  cwt: 61,
} as const;

/** COSE header parameter labels (IANA COSE Header Parameters). */
export const COSE_HEADER = {
  alg: 1,
  crit: 2,
  contentType: 3,
  kid: 4,
  iv: 5,
  typ: 16, // RFC 9596
} as const;

const EMPTY = Buffer.alloc(0);

/**
 * The protected header is a byte string wrapping the deterministically-CBOR-
 * encoded header map. An EMPTY protected header is a zero-length byte string
 * (`h''`), NOT the encoding of an empty map (RFC 9052 §3).
 */
export const encodeProtectedHeader = (header: Map<number, unknown>): Buffer =>
  header.size === 0 ? EMPTY : encodeCbor(header);

export const decodeProtectedHeader = (bstr: Uint8Array): Map<number, unknown> =>
  bstr.length === 0 ? new Map() : decodeCbor<Map<number, unknown>>(bstr);

/**
 * The to-be-signed bytes for COSE_Sign1: `Sig_structure` =
 * ["Signature1", protected, external_aad, payload] (RFC 9052 §4.4).
 */
export const buildSigStructure = (
  protectedHeader: Buffer,
  payload: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["Signature1", protectedHeader, externalAad, payload]);

/**
 * The to-be-MAC'd bytes for COSE_Mac0: `MAC_structure` =
 * ["MAC0", protected, external_aad, payload] (RFC 9052 §6.3).
 */
export const buildMacStructure = (
  protectedHeader: Buffer,
  payload: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["MAC0", protectedHeader, externalAad, payload]);

/**
 * The AAD for COSE_Encrypt0: `Enc_structure` =
 * ["Encrypt0", protected, external_aad] (RFC 9052 §5.3). 3-element (no payload).
 */
export const buildEncStructure = (
  protectedHeader: Buffer,
  externalAad: Buffer = EMPTY,
): Buffer => encodeCbor(["Encrypt0", protectedHeader, externalAad]);
