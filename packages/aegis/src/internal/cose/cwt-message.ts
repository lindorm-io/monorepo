import { isObject } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import { CoseError } from "../../errors/index.js";
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
 * Decode CWT Message bytes back to the COSE-name-keyed WIRE claims dict, or refuse
 * the token: the Message is a CBOR map. RFC 8392 §2, RFC 8392 §7.2.
 *
 * `preferMap: false` so nested claim objects decode as plain objects; the top CWT
 * map keeps integer keys, so it stays a `Map` the codec reads as the claims map. A
 * claims map whose keys are ALL text decodes as a plain OBJECT instead, which is
 * why both clear the gate and `decodeCwtClaims` normalises back to a `Map`.
 *
 * ⛔ NO cty-driven parse here, on either wire. RFC 8392 §7.2, RFC 8392 Appendix
 * A.6. Routing these bytes through the content codec lets a caller `header.cty`
 * decide how the claims are read, so a CWT minted with `cty: application/json`
 * verifies as a raw `SyntaxError` while the wire decoder reads it fine.
 */
export const decodeCwtMessage = (bytes: Buffer | Uint8Array): Dict => {
  const decoded = decodeCbor<unknown>(bytes, { preferMap: false });

  if (decoded instanceof Map || isObject(decoded)) return decodeCwtClaims(decoded);

  // ⚠ NARROWED, NOT CAST. `requireBstr` reaches the Message BYTES, and a byte
  // string holding any other CBOR type clears it — the slot is well-formed and the
  // claims set inside it is not. `decodeCwtClaims` rebuilds a non-`Map` through
  // `Object.entries` (`cwt-claims.ts`), which answers a raw `TypeError` outside the
  // `AegisError` contract on nil and fabricates index-keyed claims from an array or
  // a tstr — a claims bag on a token that carries no claims set.
  throw new CoseError("Malformed CWT claims set", {
    code: "cose_malformed",
    title: "Malformed CWT Claims Set",
    details: "The CWT payload does not hold a CBOR claims map.",
  });
};
