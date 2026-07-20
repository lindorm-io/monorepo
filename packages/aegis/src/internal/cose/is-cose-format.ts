import { coseByJose } from "../header/header-registry.js";
import { Tag, decodeCbor } from "./cbor.js";
import { COSE_TAG, decodeProtectedHeader } from "./structures.js";

/**
 * The COSE sub-format detectors — the wire-family twins of `isJwt`/`isJws`/`isJwe`
 * (Bit 8 symmetry). They operate on the decoded COSE bytes; `Aegis.isCwt`/
 * `isCws`/`isCwe` add the cheap dot-guard + base64url decode on top, exactly as
 * `Aegis.isCose` wraps `is-cose.ts`.
 *
 * The JOSE guards discriminate JWT vs JWS by the `typ` media-type SUFFIX
 * (`+jwt` vs `+jws`), because both are the same JWS wire structure; the COSE
 * claims formats mirror that — a CWT and a CWS are both a COSE_Sign1/Mac0, so
 * they are told apart by the COSE `typ` label (RFC 9596, `+cwt` vs `+cws`). A
 * CWE is a distinct COSE_Encrypt0 STRUCTURE, so it is recognised structurally
 * like `isJwe`'s five-part JWE (a `+cwe` typ also qualifies). All three never
 * throw: malformed / non-COSE input is simply `false`.
 */

// Unwrap an optional outer CWT tag (61) to the inner COSE structure Tag.
const innerCose = (value: unknown): Tag | undefined => {
  const cose =
    value instanceof Tag && value.tag === COSE_TAG.cwt ? value.contents : value;
  return cose instanceof Tag ? cose : undefined;
};

// The inner COSE structure tag (Sign1 / Mac0 / Encrypt0), or `undefined`. The
// CBOR tag number widens to bigint, so keep it untyped-narrow and compare against
// the numeric COSE_TAG constants (exactly as `is-cose.ts` does).
const structureTag = (bytes: Buffer): Tag["tag"] | undefined => {
  try {
    return innerCose(decodeCbor(bytes))?.tag;
  } catch {
    return undefined;
  }
};

// The COSE `typ` media type (protected header label 16, RFC 9596), or `undefined`.
const coseTyp = (bytes: Buffer): string | undefined => {
  try {
    const contents = innerCose(decodeCbor(bytes))?.contents;
    const protectedBstr = Array.isArray(contents) ? contents[0] : undefined;
    if (!(protectedBstr instanceof Uint8Array)) return undefined;
    const typ = decodeProtectedHeader(protectedBstr).get(coseByJose("typ"));
    return typeof typ === "string" ? typ : undefined;
  } catch {
    return undefined;
  }
};

const SIGNED_STRUCTURE = (bytes: Buffer): boolean => {
  const tag = structureTag(bytes);
  return tag === COSE_TAG.sign1 || tag === COSE_TAG.mac0;
};

const hasSuffix = (typ: string | undefined, media: string, suffix: string): boolean =>
  typ === media || (typeof typ === "string" && typ.endsWith(suffix));

/** A claims-bearing CWT (COSE_Sign1/Mac0 with a `application/cwt` / `+cwt` typ). */
export const isCwt = (bytes: Buffer): boolean =>
  SIGNED_STRUCTURE(bytes) && hasSuffix(coseTyp(bytes), "application/cwt", "+cwt");

/** An opaque signed CWS (COSE_Sign1/Mac0 with a `application/cws` / `+cws` typ). */
export const isCws = (bytes: Buffer): boolean =>
  SIGNED_STRUCTURE(bytes) && hasSuffix(coseTyp(bytes), "application/cws", "+cws");

/** An encrypted CWE (COSE_Encrypt0 structure, or a `application/cwe` / `+cwe` typ). */
export const isCwe = (bytes: Buffer): boolean =>
  structureTag(bytes) === COSE_TAG.encrypt0 ||
  hasSuffix(coseTyp(bytes), "application/cwe", "+cwe");
