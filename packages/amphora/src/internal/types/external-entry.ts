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
  /**
   * WHERE this source came from, and therefore which refresh mechanism owns it.
   * Written once at SEED beside `scope`, for the same reason and never derived.
   *
   * - `declared` — an operator's standing declaration: the constructor `external`
   *   array, and the idp however it arrived. The SCHEDULED sweep (`refreshAll`)
   *   covers exactly these, unconditionally.
   * - `registered` — created by a request through `external.addIssuer`. The
   *   scheduled sweep skips it: its population is sized by CLIENT registrations,
   *   and a timer that refetched all of them would poll the entire client
   *   population on one cadence. It is refreshed by the DEMAND path instead —
   *   scoped staleness (gated by `retryAfter`) and a kid/query miss (never
   *   gated) — which reaches precisely the issuers actually in use.
   */
  origin: "declared" | "registered";
  /**
   * Consecutive FAILED load attempts, reset to 0 by `applyFetchedKeys`. It earns
   * its place twice: it is `computeDelay`'s attempt argument, and it is what
   * separates a first failure (a dependency just went down) from the hundredth
   * (already reported) in the logs.
   */
  failureCount: number;
  /**
   * The DECISION, not its inputs: no SPECULATIVE refetch of this issuer before
   * this instant. Stamped by `scheduleRetry`, cleared on success.
   *
   * `lastRefresh` cannot answer this. It records when keys last LANDED, so
   * `lastRefresh === null` is equally consistent with never-attempted,
   * failed-3ms-ago and failed-400-times — no arithmetic recovers a retry
   * decision from it. Storing the decision keeps the policy in one place
   * (`scheduleRetry`) and leaves every reader with one number to compare.
   *
   * ⚠ It gates STALENESS and never a MISS. A client whose endpoint was failing
   * and has since rotated a kid must not be locked out for the backoff window —
   * the miss path does not route through `entryStale`, so it cannot be.
   */
  retryAfter: Date | null;
};
