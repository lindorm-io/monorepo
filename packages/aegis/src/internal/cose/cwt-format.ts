import type { CwtClaimsWire } from "../../types/index.js";
import type { CoseLabel } from "./cose-label.js";
import type { SignedCoseFormat } from "./error-by-format.js";

/**
 * The shared VOCABULARY of the CWT core (RFC 8392) — the format tag, the structure
 * gate and the unverified decode view that `signCwt`, `verifyCwt`, `decodeCwtWire`
 * and `decodeCwt` all speak.
 *
 * It serves both claims kits: `CwtKit` (COSE_Sign1) and `CwmKit` (COSE_Mac0). The
 * kits are thin algClass-gated shells over one shared body, because the Sign1/Mac0
 * split is decided by the KEY, not by the kit.
 *
 * ⛔ This layer sits BELOW the kits and composes UTILITIES ONLY — never construct
 * one here. `CwtKit`/`CwmKit` import it, so reaching up for `CwsKit` would leave
 * the claims layer with no door of its own; the three kits are SIBLINGS over the
 * same utils.
 *
 * Everything here speaks the WIRE claim dict — `cti`, not the domain `tokenId`.
 * The domain⇆wire translation is the Aegis-side `signCose`/`verifyCose` boundary,
 * never the kit.
 */

/**
 * The two claims-kit formats, used to namespace the structural error codes —
 * the claims half of the signed COSE set the shared error table is keyed by.
 */
export type CwtFormat = Extract<SignedCoseFormat, "cwt" | "cwm">;

export type CwtDecoded = {
  /** The COSE structure inside the CWT (a COSE_Sign1 or COSE_Mac0 Tag). */
  cose: unknown;
  /**
   * The PROTECTED bucket as its RAW COSE label map — the vocabulary the two label
   * forms of one numeral are still distinct in (RFC 9052 §1.5), which is what the
   * crit label rule needs (`internal/header/assert-cose-crit-carried.ts`). The
   * translated JOSE-named twin is `coseWireHeader`'s, and it is lossy on purpose.
   */
  protectedMap: Map<CoseLabel, unknown>;
  kid: string | undefined;
  algorithm: string | undefined;
  typ: string | undefined;
  /**
   * ⚠ UNVERIFIED cleartext WIRE claims — the COSE-name-keyed dict, decoded with
   * the same codec `decodeCwtWire`/`verifyCwt` use. A signature or MAC
   * authenticates without concealing, so the payload is readable before a key is
   * held; the encrypted CWE twin has no such payload and is decoded by
   * `decodeEncryptedCoseKid`.
   *
   * ⚠⚠ NOTHING has authenticated these claims. Safe for NARROWING a key lookup —
   * restricting the candidate set can only produce a miss — and nothing else.
   *
   * `undefined` when there are no claims to read: a DETACHED (nil) payload, or a
   * payload that is not a CBOR claims map at all, since this decode also serves
   * the OPAQUE CWS path.
   */
  payload: CwtClaimsWire | undefined;
};
