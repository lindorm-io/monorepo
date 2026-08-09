import type { AmphoraExternalConfig } from "../../types/index.js";

/**
 * The MUTABLE, progressively-ENRICHED state behind one registered external issuer
 * source. Amphora-internal: it is never exported and never returned to a consumer.
 *
 * It differs from the public {@link AmphoraExternalConfig} in exactly one place —
 * `issuer` is still `null` between REGISTRATION and RESOLUTION. A source declared
 * by `openIdConfigurationUri` alone names no issuer until amphora has fetched that
 * document, so a constructor-declared source carries that window until `setup()`
 * (and keeps it if a non-`required` fetch failed there). `toExternalConfig` is the
 * single point where the nullability stops.
 */
export type ExternalEntry = Omit<AmphoraExternalConfig, "issuer"> & {
  issuer: string | null;
  /**
   * Which issuer scope this entry belongs to. Written once at SEED and never
   * derived: a registration resolves and fetches into a STAGED entry before it
   * replaces the serving one, so "is this the idp?" cannot be answered by
   * identity against `state.idpEntry` — the staged entry is not installed yet,
   * and the entry it is about to replace still is.
   */
  scope: "external" | "idp";
};
