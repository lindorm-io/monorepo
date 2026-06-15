/**
 * The wire encoding a profiled mint/verify call targets. Everything above this
 * seam (domain claim assembly, profiles, validation, the verify floor) is
 * encoding NEUTRAL — it operates on the domain-keyed common claims with no
 * JOSE- or COSE-specific assumptions. The format selected here is the only
 * place a concrete wire format is bound, dispatched by mintProfile/verifyProfile.
 */
export type TokenFormat = "jwt" | "cose";

export type SelectedEncoder = {
  format: TokenFormat;
};

/**
 * Pure format resolver: defaults to `"jwt"`. The actual dispatch (JOSE path vs
 * the COSE path) happens in mintProfile/verifyProfile on this result — the
 * COSE path currently throws `cose_not_supported` until the encoder lands.
 */
export const selectEncoder = (format: TokenFormat = "jwt"): SelectedEncoder => ({
  format,
});
