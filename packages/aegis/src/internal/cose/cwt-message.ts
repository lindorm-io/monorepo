import type { Dict } from "@lindorm/types";
import { decodeCbor, encodeCbor } from "./cbor.js";
import { decodeCwtClaims, encodeCwtClaims } from "./cwt-claims.js";

/**
 * The CWT **Message** — the ONE byte form every COSE claims wire carries, wrapped
 * as a COSE_Sign1/COSE_Mac0 Payload or a COSE_Encrypt0 plaintext. RFC 8392 §7.1,
 * RFC 8392 §7.2.
 *
 * ⚠ The encoding is a property of the CLAIMS SET, not of the wire carrying it, so
 * every producer calls {@link encodeCwtMessage} and every consumer
 * {@link decodeCwtMessage}. The signed and encrypted claims wires cannot drift
 * apart while they share these two functions.
 */

/**
 * Encode an ALREADY-WIRE (COSE-name-keyed) claims dict to CWT Message bytes.
 * `proprietary` threads to the codec, choosing compact private-use integer labels
 * over their interoperable string form; the default is interoperable.
 */
export const encodeCwtMessage = (wire: Dict, proprietary?: boolean): Buffer =>
  encodeCbor(encodeCwtClaims(wire, { proprietary }));

/**
 * Decode CWT Message bytes back to the COSE-name-keyed WIRE claims dict.
 *
 * `preferMap: false` so nested claim objects decode as plain objects; the top CWT
 * map keeps integer keys, so it stays a `Map` the codec reads as the claims map.
 *
 * ⛔ NO cty-driven parse here, on either wire. RFC 8392 §7.2, RFC 8392 Appendix
 * A.6. Routing these bytes through the content codec lets a caller `header.cty`
 * decide how the claims are read, so a CWT minted with `cty: application/json`
 * verifies as a raw `SyntaxError` while the wire decoder reads it fine.
 */
export const decodeCwtMessage = (bytes: Buffer | Uint8Array): Dict =>
  decodeCwtClaims(decodeCbor<Map<unknown, unknown>>(bytes, { preferMap: false }));
