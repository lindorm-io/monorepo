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
 * namespace rather than the shared `CoseError` parent — as `JwtKit` throws
 * `JwtError`. A caller may still catch the family via `CoseError`.
 *
 * ONE table for the whole signed side: a second copy forks the moment a fourth
 * format or a renamed leaf arrives.
 */
export const ERROR_BY_FORMAT: Record<SignedCoseFormat, typeof CoseError> = {
  cws: CwsError,
  cwt: CwtError,
  cwm: CwmError,
};
