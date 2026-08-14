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
 * Best-effort decode of the CWT payload byte string into the WIRE claim dict,
 * for the pre-verification {@link CwtDecoded}. It NEVER throws — every caller of
 * `decodeCwt` is resolving a key, not reading claims, and two legitimate inputs
 * carry no claims at all: a DETACHED (nil) payload, which is legal COSE, and an
 * OPAQUE CWS payload, which is arbitrary bytes rather than a CBOR claims map. So
 * a payload this cannot read is reported as "no claims", not as a malformed
 * token — the structural verdict belongs to `verifyCwt`/`decodeCwtWire`, which
 * decode the payload in their own right.
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
 * Decode a CWT WITHOUT verifying — the pre-verification twin of the JOSE
 * `JwtKit.decode`, exposing what a caller needs before it holds a key: the
 * kid/alg/typ off the COSE headers, and the cleartext WIRE claims (`payload`).
 * Both are UNVERIFIED; see {@link CwtDecoded}.
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
