import type { Dict } from "@lindorm/types";
import { decodeCbor, encodeCbor } from "./cbor.js";
import { decodeCwtClaims, encodeCwtClaims } from "./cwt-claims.js";

/**
 * The CWT **Message** — RFC 8392 §7.1 step 2: "Let the Message be the binary
 * representation of the CWT Claims Set." It is the ONE byte form every COSE
 * claims wire carries, and §7.1 step 4 is explicit that the three wires differ
 * only in what they wrap it in: a COSE_Sign1 takes it as its Payload, a
 * COSE_Mac0 as its Payload, and a COSE_Encrypt0 "using the Message as the
 * plaintext". §7.2 step 7 closes the loop on the read side — "Verify that the
 * Message is a valid CBOR map; let the CWT Claims Set be this CBOR map."
 *
 * So the encoding is a property of the CWT claims set, NOT of the wire that
 * carries it, and this pair is where that fact lives: every producer of a COSE
 * claims message calls {@link encodeCwtMessage} and every consumer calls
 * {@link decodeCwtMessage}. The signed and the encrypted claims wires cannot
 * drift apart while they share these two functions — they did drift once,
 * because the encrypted wire built its own bytes.
 */

/**
 * Encode an ALREADY-WIRE (COSE-name-keyed) claims dict to the CWT Message bytes:
 * the claims map through the registry codec (integer labels where the registry
 * has one, the wire string name where it does not), then CBOR. `proprietary`
 * threads to the codec, where it chooses the compact private-use integer labels
 * over their interoperable string form (D5 — the default is interoperable).
 */
export const encodeCwtMessage = (wire: Dict, proprietary?: boolean): Buffer =>
  encodeCbor(encodeCwtClaims(wire, { proprietary }));

/**
 * Decode CWT Message bytes back to the COSE-name-keyed WIRE claims dict.
 *
 * `preferMap: false` so nested claim objects (`act`, `sub_id`, `events`, custom)
 * decode as plain objects; the top CWT map keeps integer keys, so it stays a
 * `Map` and the codec reads it as the claims map it is.
 *
 * There is NO cty-driven parse here, on either wire. RFC 8392 §7.2 step 7 reads
 * the Message as a CBOR map and nothing else, and `cty` on a CWT signals NESTING
 * (RFC 8392 Appendix A.6). Routing these bytes through the content codec instead
 * let a caller `header.cty` decide how the claims were read, so a CWT minted with
 * `cty: application/json` verified as a raw `SyntaxError` while the wire decoder —
 * which decodes straight, as here — read the same token fine.
 */
export const decodeCwtMessage = (bytes: Buffer | Uint8Array): Dict =>
  decodeCwtClaims(decodeCbor<Map<unknown, unknown>>(bytes, { preferMap: false }));
