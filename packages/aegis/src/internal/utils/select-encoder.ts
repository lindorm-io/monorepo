/**
 * The wire encoding a profiled mint/verify call targets. Everything above this
 * seam (domain claim assembly, profiles, validation, the verify floor) is
 * encoding NEUTRAL — it operates on the domain-keyed common claims with no
 * JOSE- or COSE-specific assumptions. The format selected here is the only
 * place a concrete wire format is bound, dispatched by mintProfile/verifyProfile.
 */
export type TokenFormat = "jws" | "jwt" | "cws" | "cwt" | "cwm";

export type SelectedEncoder = {
  format: TokenFormat;
};

/**
 * Pure format resolver: defaults to `"jwt"`. The actual dispatch happens on this
 * result in signRaw (raw JWS `"jws"` vs raw COSE_Sign1 `"cws"`) and
 * mintProfile/verifyProfile (profiled JWT `"jwt"` vs profiled CWT `"cwt"`). The
 * `cws`/`cwt` namespaces are the ergonomic surface over the same mechanism.
 */
export const selectEncoder = (format: TokenFormat = "jwt"): SelectedEncoder => ({
  format,
});
