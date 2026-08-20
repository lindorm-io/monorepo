import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
import type { CoseDecodedStructuredToken, CwtClaimsWire } from "../../types/index.js";
import { decodeCwtMessage } from "./cwt-message.js";
import { requireAttachedPayload } from "./require-attached-payload.js";
import { requireSignature } from "./require-signature.js";
import { splitSigned } from "./split-signed.js";

/**
 * Decode a CWT to its unified WIRE view WITHOUT verifying — the shared body of
 * `CwtKit.decode`/`CwmKit.decode` (COSE_Sign1 ≡ COSE_Mac0 here). Merges the
 * protected + unprotected COSE header maps into ONE `WireTokenHeader` (integer
 * labels translated to their JOSE wire names), and decodes the CBOR claims
 * payload into the COSE-name-keyed WIRE claim map — NO signature/MAC check, NO
 * domain translation. Mirrors `JwtKit.decode`.
 */
export const decodeCwtWire = <C extends Dict = Dict>(
  token: Buffer,
): CoseDecodedStructuredToken<CwtClaimsWire & C> => {
  const {
    payload: payloadBstr,
    signature,
    protectedHeader,
    unprotectedHeader,
    custom,
  } = splitSigned(token, {
    arity: { atLeast: 3 },
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT does not contain a recognisable COSE structure.",
  });

  // ⚠ BEHAVIOUR CHANGE (ORDERING). `splitSigned` decodes and translates the
  // protected header EAGERLY (`internal/cose/split-signed.ts`), so the header
  // decode now runs BEFORE this check; it used to run after. A token that is
  // doubly malformed — a nil payload AND a protected byte string that is not
  // CBOR — therefore answers `cbor_decode_failed` where it once answered
  // `cose_malformed`. Both are `CoseError` refusals of the same token, and the
  // eager decode is what lets one opening serve all three callers.
  //
  // A COSE_Sign1/Mac0 may carry a DETACHED (nil) payload — legal COSE, but there
  // are then no claims to decode. Refused with the clean structural error rather
  // than letting `Buffer.from(null)` throw a raw, confusing TypeError.
  const payloadBytes = requireAttachedPayload(payloadBstr, {
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT has a detached or nil payload, so its claims cannot be decoded.",
  });

  // The same structure can leave slot 4 nil too, and this decode used to answer
  // that by fabricating `Buffer.alloc(0)` — an empty signature a caller cannot
  // tell from a real zero-length one, and the only read path that did NOT refuse
  // the token (the three that cast the `null` crashed with a raw TypeError). It
  // is refused here on the same structural verdict, so decode and verify agree
  // about a nil-signature token exactly as they do about a nil payload.
  const signatureBytes = requireSignature(signature, {
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT has a nil signature, so the structure is incomplete.",
  });

  // The payload byte string is the CWT Message; decode it through the ONE codec
  // `verifyCwt` and the encrypted claims wire use, so all three agree.
  const payload = decodeCwtMessage(payloadBytes);

  return {
    protectedHeader,
    unprotectedHeader,
    custom,
    payload: payload as CwtClaimsWire & C,
    signature: signatureBytes,
    token,
  };
};
