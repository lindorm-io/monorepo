import type { CwtClaimsWire } from "../../types/index.js";
import type { SignedCoseFormat } from "./error-by-format.js";

/**
 * The shared VOCABULARY of the CWT (RFC 8392) core — the format tag, the
 * structure gate and the unverified decode view that `signCwt`, `verifyCwt`,
 * `decodeCwtWire` and `decodeCwt` all speak. Those four verbs live in their own
 * files beside this one; this is the spine they agree on.
 *
 * The core serves the two claims-bearing kits — `CwtKit` (COSE_Sign1,
 * asymmetric) and `CwmKit` (COSE_Mac0, symmetric). The kits are the thin,
 * algClass-GATED public shells; these modules are the wire-only body they both
 * delegate to (house rule: thin class wrappers over utility functions, no
 * duplication). The two kits have BYTE-IDENTICAL bodies — the Sign1/Mac0 split
 * is decided by the key, not by the kit — which is why one shared body exists
 * here and none exists on the JOSE side, where `JwtKit` and `JwsKit` do
 * different work.
 *
 * ⛔ This layer sits BELOW the kits and composes UTILITIES ONLY — it must never
 * construct one. `CwtKit`/`CwmKit` import it, so reaching back up for `CwsKit`
 * would make the opaque signer serve three kits and leave the claims layer with
 * no door of its own. `CwsKit`, `CwtKit` and `CwmKit` are SIBLINGS over the same
 * utils, exactly as `JwsKit` and `JwtKit` are.
 *
 * Everything here speaks the WIRE (COSE-name-keyed) claim dict — `cti`, not the
 * domain `tokenId` — exactly as `JwtKit` speaks the JOSE wire. The domain⇆wire
 * translation is the Aegis-side `signCose`/`verifyCose` boundary (the COSE twin
 * of the JOSE `signJwtWire` seam), never the kit.
 */

/**
 * The two claims-kit formats, used to namespace the structural error codes —
 * the claims half of the signed COSE set the shared error table is keyed by.
 */
export type CwtFormat = Extract<SignedCoseFormat, "cwt" | "cwm">;

export type CwtDecoded = {
  /** The COSE structure inside the CWT (a COSE_Sign1 or COSE_Mac0 Tag). */
  cose: unknown;
  kid: string | undefined;
  algorithm: string | undefined;
  typ: string | undefined;
  /**
   * ⚠ UNVERIFIED cleartext WIRE claims — the COSE-name-keyed dict, exactly what
   * `decodeCwtWire`/`verifyCwt` produce, decoded with the same codec.
   *
   * A CWT is a COSE_Sign1 and a CWM a COSE_Mac0, so the payload is cleartext
   * CBOR (a signature/MAC authenticates, it does not conceal) — the COSE twin of
   * a JWS/JWT payload being cleartext base64url. That is why the JOSE seam can
   * read `JwtKit.decode(token).payload` before it holds a key, and why this can
   * too. The CWE (COSE_Encrypt0) twin of a JWE has no such payload and is
   * decoded elsewhere (`decodeEncryptedCoseKid`), which is the right shape.
   *
   * ⚠⚠ NOTHING has authenticated these claims. They are safe for NARROWING a key
   * lookup — restricting the candidate set can only ever produce a miss — and
   * for nothing else. Never treat a value read here as an assertion; the
   * authenticated claims are the verify result's.
   *
   * `undefined` when there are no claims to read: a DETACHED (nil) payload,
   * which is legal COSE, or a payload that is not a CBOR claims map at all —
   * this same decode serves the OPAQUE CWS path, whose payload is arbitrary
   * bytes.
   */
  payload: CwtClaimsWire | undefined;
};
