import { isString } from "@lindorm/is";
import { bareMediaType } from "./content-codec.js";

/**
 * The CLAIMS-BEARING nested-token media types. A strict subset of the token ctys
 * {@link reconstructStrategy} recognises: those also cover the OPAQUE (`+cws`)
 * and ENCRYPTED (`+cwe`) nestings, which carry no claims layer — the same split
 * `parse-token.ts` draws between STRUCTURED and UNSTRUCTURED.
 *
 * `JWT` (the RFC 7519 §5.2 short form) and `application/jwt` are what the JOSE
 * sign-then-encrypt path stamps; `application/cwt` (RFC 8392) is its COSE twin.
 */
const CLAIMS_MEDIA_TYPES: ReadonlyArray<string> = [
  "application/cwt",
  "application/jwt",
  "jwt",
];

const CLAIMS_MEDIA_SUFFIXES: ReadonlyArray<string> = ["+cwm", "+cwt", "+jwt"];

/**
 * Does a DECLARED content type (a JOSE `cty` / COSE label-3 `cty`) name a
 * claims-bearing nested token? This is the keyless half of "can aegis establish
 * claims from this encrypted token": the ciphertext is unreadable, but its
 * envelope declares what it holds, and only a JWT/CWT/CWM declaration means
 * claims. An absent, parameterised-but-unknown, opaque (`+jws`/`+cws`) or plain
 * (`text/plain`, `application/json`) cty is not one.
 *
 * Tolerant of RFC 2045 parameters, exactly like the codec that reads it.
 */
export const isClaimsContentType = (cty: string | undefined): boolean => {
  if (!isString(cty)) return false;

  const bare = bareMediaType(cty);

  return (
    CLAIMS_MEDIA_TYPES.includes(bare) ||
    CLAIMS_MEDIA_SUFFIXES.some((suffix) => bare.endsWith(suffix))
  );
};
