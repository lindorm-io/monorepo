import { AegisError } from "../../errors/index.js";

/**
 * The wire encoding a profiled mint/verify call targets. Everything above this
 * seam (claim mapping, profiles, validation, the verify floor) is encoding
 * NEUTRAL — it operates on a plain claims dict with no JOSE-specific
 * assumptions. The encoder selected here is the only place a concrete wire
 * format (JOSE today, COSE/CWT in the future) is bound.
 */
export type TokenFormat = "jwt" | "cose";

/**
 * The encoder the profiled paths dispatch to. `"jwt"` is the JOSE encoder that
 * already backs mint/verify. `"cose"` is reserved for the planned CBOR/CWT
 * encoder; until it lands, selecting it throws cleanly so the seam is observable
 * and a future CBOR encoder can slot in here without touching the layers above.
 */
export type SelectedEncoder = {
  format: TokenFormat;
};

/**
 * Pure encoder selection. Given a per-call `format` (default `"jwt"`), returns
 * the encoder descriptor for the JOSE path, or throws `NotSupportedError` for
 * `"cose"` — COSE/CWT is planned but not yet implemented.
 *
 * This is deliberately a thin seam: the goal is that the day a CBOR encoder
 * exists, it is wired in here and nothing above the encoding boundary changes.
 */
export const selectEncoder = (format: TokenFormat = "jwt"): SelectedEncoder => {
  if (format === "cose") {
    throw new AegisError("COSE encoding is not supported", {
      code: "cose_not_supported",
      data: { format },
      title: "COSE Not Supported",
      details:
        "COSE/CWT encoding is planned but not yet implemented; only the JWT (JOSE) format is currently available.",
    });
  }

  return { format };
};
