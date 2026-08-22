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

  // ⚠ `splitSigned` decodes and translates the protected header EAGERLY, so a
  // doubly malformed token — nil payload AND a protected byte string that is not
  // CBOR — answers `cbor_decode_failed` rather than `cose_malformed`. Both are
  // `CoseError` refusals; the eager decode is what lets one opening serve all
  // three callers.
  //
  // A DETACHED (nil) payload is legal COSE but has no claims to decode. Refused
  // with the structural error rather than letting `Buffer.from(null)` throw a raw
  // TypeError.
  const payloadBytes = requireAttachedPayload(payloadBstr, {
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT has a detached or nil payload, so its claims cannot be decoded.",
  });

  // Slot 4 can be nil too. Refused on the same structural verdict, so decode and
  // verify agree about a nil-signature token exactly as they do about a nil
  // payload — fabricating `Buffer.alloc(0)` would hand back an empty signature a
  // caller cannot tell from a real zero-length one.
  const signatureBytes = requireSignature(signature, {
    error: CoseError,
    message: "Malformed CWT",
    title: "Malformed CWT",
    details: "The CWT has a nil signature, so the structure is incomplete.",
  });

  // The payload byte string is the CWT Message, decoded through the ONE codec
  // `verifyCwt` and the encrypted claims wire use.
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
