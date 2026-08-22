import { isString } from "@lindorm/is";
import { coseByJose } from "../header/header-registry.js";
import type { Tag } from "./cbor.js";
import { decodeCbor } from "./cbor.js";
import { COSE_TAG, decodeProtectedHeader } from "./structures.js";
import { coseStructure } from "./unwrap-cose.js";

/**
 * The COSE sub-format detectors — the wire-family twins of `isJwt`/`isJws`/`isJwe`,
 * over decoded COSE bytes. `Aegis.isCwt`/`isCws`/`isCwe` add the cheap dot-guard
 * and base64url decode on top.
 *
 * A CWT and a CWS share the COSE_Sign1/Mac0 structure, so they are told apart by
 * the COSE `typ` media type (RFC 9596) exactly as a `+jws` JWS is told from a
 * `+jwt` JWT; a CWE is a distinct COSE_Encrypt0 and is recognised structurally.
 * None of them throw — malformed or non-COSE input is `false`.
 */

// The inner COSE structure tag, or `undefined`. ⚠ The CBOR tag number widens to
// bigint, so it stays untyped-narrow and is compared against the numeric COSE_TAG
// constants, as `is-cose.ts` does.
const structureTag = (bytes: Buffer): Tag["tag"] | undefined => {
  try {
    return coseStructure(decodeCbor(bytes))?.tag;
  } catch {
    return undefined;
  }
};

// A string-valued COSE PROTECTED header parameter, read by its JOSE name. Keyless
// and never throws: the protected header is cleartext CBOR on every COSE
// structure, encrypted ones included.
const coseProtected = (bytes: Buffer, jose: string): string | undefined => {
  try {
    const contents = coseStructure(decodeCbor(bytes))?.contents;
    const protectedBstr = Array.isArray(contents) ? contents[0] : undefined;
    if (!(protectedBstr instanceof Uint8Array)) return undefined;
    const value = decodeProtectedHeader(protectedBstr).get(coseByJose(jose));
    return isString(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

// The COSE `typ` media type off the protected header. RFC 9596.
const coseTyp = (bytes: Buffer): string | undefined => coseProtected(bytes, "typ");

/**
 * The COSE `cty` — the DECLARED content type of the structure's payload. On a CWE
 * that declares what the CIPHERTEXT holds, readable without the decryption key
 * because the protected header is cleartext and AAD-covered.
 */
export const coseCty = (bytes: Buffer): string | undefined => coseProtected(bytes, "cty");

const SIGNED_STRUCTURE = (bytes: Buffer): boolean => {
  const tag = structureTag(bytes);
  return tag === COSE_TAG.sign1 || tag === COSE_TAG.mac0;
};

const hasSuffix = (typ: string | undefined, media: string, suffix: string): boolean =>
  typ === media || (isString(typ) && typ.endsWith(suffix));

/**
 * A claims-bearing CWT signed with COSE_Sign1. ⚠ `cwt` and `cwm` are disjoint by
 * STRUCTURE, so a COSE_Mac0 with a `+cwt` typ is a CWM, not a CWT.
 */
export const isCwt = (bytes: Buffer): boolean =>
  structureTag(bytes) === COSE_TAG.sign1 &&
  hasSuffix(coseTyp(bytes), "application/cwt", "+cwt");

/** A claims-bearing CWM MAC'd with COSE_Mac0 — the symmetric CWT twin. */
export const isCwm = (bytes: Buffer): boolean =>
  structureTag(bytes) === COSE_TAG.mac0 &&
  hasSuffix(coseTyp(bytes), "application/cwt", "+cwt");

/** An opaque signed CWS — a COSE_Sign1/Mac0 with an `application/cws` typ. */
export const isCws = (bytes: Buffer): boolean =>
  SIGNED_STRUCTURE(bytes) && hasSuffix(coseTyp(bytes), "application/cws", "+cws");

/** An encrypted CWE — a COSE_Encrypt0 structure, or an `application/cwe` typ. */
export const isCwe = (bytes: Buffer): boolean =>
  structureTag(bytes) === COSE_TAG.encrypt0 ||
  hasSuffix(coseTyp(bytes), "application/cwe", "+cwe");
