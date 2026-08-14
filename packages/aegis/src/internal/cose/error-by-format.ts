import { type CoseError, CwmError, CwsError, CwtError } from "../../errors/index.js";
import type { TokenFormatTag } from "../../types/index.js";

/**
 * The three COSE SIGNED formats one signer serves. It is the FORMAT, not merely
 * a media-type family: it picks the `typ` a kit stamps, the capability row it
 * enforces, and the namespace of the errors it raises.
 */
export type SignedCoseFormat = Extract<TokenFormatTag, "cws" | "cwt" | "cwm">;

/**
 * The leaf error class for each signed COSE format, so a throw lands on its own
 * namespace (`CwsError`/`CwtError`/`CwmError`) rather than the shared `CoseError`
 * parent — exactly as `JwtKit` throws `JwtError`. A caller may still catch the
 * whole family via `CoseError` (or `AegisError`).
 *
 * ONE table for the whole signed side: the opaque signer and the claims core
 * kept their own copies, agreeing on the `cwt`/`cwm` rows, which is a fork
 * waiting to happen the moment a fourth format or a renamed leaf arrives.
 */
export const ERROR_BY_FORMAT: Record<SignedCoseFormat, typeof CoseError> = {
  cws: CwsError,
  cwt: CwtError,
  cwm: CwmError,
};
