import type { AmphoraExternalConfig } from "../../types/index.js";

/**
 * The MUTABLE, progressively-ENRICHED state behind one registered external issuer
 * source. Amphora-internal: it is never exported and never returned to a consumer.
 *
 * It differs from the public {@link AmphoraExternalConfig} in exactly one place —
 * `issuer` is still `null` between REGISTRATION and RESOLUTION. A source declared
 * by `openIdConfigurationUri` alone names no issuer until amphora has fetched that
 * document, and registration is lazy by default, so that window is ordinary rather
 * than an error. `toExternalConfig` is the single point where the nullability stops.
 */
export type ExternalEntry = Omit<AmphoraExternalConfig, "issuer"> & {
  issuer: string | null;
};
