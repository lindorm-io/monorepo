import { isNumber, isObject, isString } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CwtClaimsWire } from "../../types/index.js";
import { coseByJose } from "../header/header-registry.js";
import { coseLabelToAlg } from "./alg-labels.js";
import { decodeCbor } from "./cbor.js";
import { decodeCwtClaims } from "./cwt-claims.js";
import type { CwtDecoded } from "./cwt-format.js";
import { requireCose } from "./require-cose.js";
import { decodeProtectedHeader } from "./structures.js";
import { stripCwtTag } from "./unwrap-cose.js";

/**
 * Best-effort decode of the CWT payload byte string into the WIRE claim dict, for
 * the pre-verification {@link CwtDecoded}.
 *
 * ⚠ It NEVER throws: every caller is resolving a key, not reading claims, and two
 * legitimate inputs carry no claims at all — a DETACHED payload, and an OPAQUE
 * CWS payload of arbitrary bytes. An unreadable payload is "no claims"; the
 * structural verdict belongs to `verifyCwt`/`decodeCwtWire`.
 */
const decodeUnverifiedClaims = (
  payloadBstr: Uint8Array | null | undefined,
): CwtClaimsWire | undefined => {
  if (payloadBstr == null) return undefined;

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

  const [protectedBstr, unprotected, payloadBstr] = contents as [
    Uint8Array,
    Map<number, unknown>,
    Uint8Array | null | undefined,
  ];
  const protectedHeader = decodeProtectedHeader(protectedBstr);

  const kidValue = unprotected.get(coseByJose("kid"));
  const algLabel = protectedHeader.get(coseByJose("alg"));
  const typ = protectedHeader.get(coseByJose("typ"));

  return {
    cose,
    kid:
      kidValue instanceof Uint8Array ? Buffer.from(kidValue).toString("utf8") : undefined,
    algorithm: isNumber(algLabel) ? coseLabelToAlg(algLabel) : undefined,
    typ: isString(typ) ? typ : undefined,
    payload: decodeUnverifiedClaims(payloadBstr),
  };
};
