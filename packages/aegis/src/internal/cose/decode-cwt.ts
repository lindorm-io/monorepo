import { isNumber, isObject, isString } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CwtClaimsWire } from "../../types/index.js";
import { coseByJose } from "../header/header-registry.js";
import { coseLabelToAlg } from "./alg-labels.js";
import { decodeCbor } from "./cbor.js";
import { decodeCwtClaims } from "./cwt-claims.js";
import type { CwtDecoded } from "./cwt-format.js";
import { requireBstr } from "./require-bstr.js";
import { requireCose } from "./require-cose.js";
import { decodeProtectedHeader } from "./structures.js";
import { stripCwtTag } from "./unwrap-cose.js";

/**
 * Best-effort decode of the CWT payload byte string into the WIRE claim dict, for
 * the pre-verification {@link CwtDecoded}.
 *
 * ⚠ It NEVER throws: every caller is resolving a key, not reading claims, and two
 * legitimate inputs carry no claims at all — a DETACHED payload, and an OPAQUE
 * CWS payload of arbitrary bytes. An unreadable payload — including a slot holding
 * something other than a byte string — is "no claims"; the structural verdict
 * belongs to `verifyCwt`/`decodeCwtWire`.
 */
const decodeUnverifiedClaims = (payloadBstr: unknown): CwtClaimsWire | undefined => {
  if (!(payloadBstr instanceof Uint8Array)) return undefined;

  try {
    const decoded = decodeCbor<unknown>(Buffer.from(payloadBstr), { preferMap: false });

    if (!(decoded instanceof Map) && !isObject(decoded)) return undefined;

    return decodeCwtClaims(decoded) as CwtClaimsWire;
  } catch {
    return undefined;
  }
};

/**
 * Decode a CWT WITHOUT verifying — the twin of `JwtKit.decode`, exposing what a
 * caller needs before it holds a key. ⚠ Everything it returns is UNVERIFIED; see
 * {@link CwtDecoded}.
 */
export const decodeCwt = (token: Buffer): CwtDecoded => {
  const cose = stripCwtTag(decodeCbor(token));
  const contents = requireCose(cose, {
    arity: { atLeast: 2 },
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT does not contain a recognisable COSE structure.",
  });

  // The protected bucket is a bstr (RFC 9052 §3), and this door reads the key hint
  // off it before any key exists. ⚠ `decodeProtectedHeader` (`structures.ts`)
  // judges the CBOR INSIDE the byte string and never the slot's own type, so this
  // is the only gate that can name a non-bstr slot 0 — and the only one keeping it
  // inside the `AegisError` contract.
  const protectedBstr = requireBstr(contents[0], {
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT protected header slot is not a byte string.",
  });
  const [, unprotected, payloadBstr] = contents;
  const protectedMap = decodeProtectedHeader(protectedBstr);

  // ⚠ NARROWED, NOT CAST — the same narrowing `splitSigned` and `CweKit` apply to
  // this slot. An unindexable bucket carries no kid hint, and this door hands back
  // a best-effort view rather than a verdict, so it reads as absent.
  const kidValue =
    unprotected instanceof Map ? unprotected.get(coseByJose("kid")) : undefined;
  const algLabel = protectedMap.get(coseByJose("alg"));
  const typ = protectedMap.get(coseByJose("typ"));

  return {
    cose,
    protectedMap,
    kid:
      kidValue instanceof Uint8Array ? Buffer.from(kidValue).toString("utf8") : undefined,
    algorithm: isNumber(algLabel) ? coseLabelToAlg(algLabel) : undefined,
    typ: isString(typ) ? typ : undefined,
    payload: decodeUnverifiedClaims(payloadBstr),
  };
};
