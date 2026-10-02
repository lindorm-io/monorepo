import { isNumber, isObject } from "@lindorm/is";
import { CoseError } from "../../errors/index.js";
import type { CwtClaimsWire } from "../../types/index.js";
import { coseWireHeader } from "../header/cose-wire-header.js";
import { coseByJose } from "../header/header-registry.js";
import { coseLabelToAlg } from "./alg-labels.js";
import { assertKidOneBucket } from "./assert-kid-one-bucket.js";
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
 * something other than a byte string — is "no claims"; the PAYLOAD's structural
 * verdict belongs to `verifyCwt`/`decodeCwtWire`.
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

  // The HEADER verdict, raised here and not left to `splitSigned` alone: the key
  // resolves off the `kid` below, before any kit opens the structure
  // (`internal/wire/cose-token-wire.ts`, `internal/utils/raw-verify-cwt.ts`), so a
  // token stating the hint twice would otherwise answer a key refusal rather than
  // a malformed one.
  assertKidOneBucket({ protectedMap, unprotected, error: CoseError });

  // ⚠ THE PROTECTED BUCKET FIRST — the unprotected one answers only where the
  // protected states no `kid` (RFC 9052 §3). The guard above is what makes the
  // fallback unambiguous: no token reaching it states the label in both.
  //
  // ⚠ NARROWED, NOT CAST — the same narrowing `splitSigned` and `CweKit` apply to
  // this slot. A bucket this reader cannot index states no hint, and a hint is all
  // it is: the key it names is proven by the signature, so an unreadable bucket
  // reads as absent and the missing-kid refusal stays `resolve-key.ts`'s to make.
  const kidLabel = coseByJose("kid");
  const kidValue =
    protectedMap.get(kidLabel) ??
    (unprotected instanceof Map ? unprotected.get(kidLabel) : undefined);
  const algLabel = protectedMap.get(coseByJose("alg"));

  return {
    cose,
    protectedMap,
    kid:
      kidValue instanceof Uint8Array ? Buffer.from(kidValue).toString("utf8") : undefined,
    algorithm: isNumber(algLabel) ? coseLabelToAlg(algLabel) : undefined,
    // ⚠ THROUGH THE HEADER CODEC, never label 16 off the raw map: this decode runs
    // before any kit reads the header, so it refuses what the typ row in
    // `header-registry.ts` refuses. pinned: `non-text-typ.test.ts`, the token-type
    // assertion rows.
    typ: coseWireHeader(protectedMap, "sig").header.typ,
    payload: decodeUnverifiedClaims(payloadBstr),
  };
};
