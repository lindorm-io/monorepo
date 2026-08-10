import type { DelayOptions } from "@lindorm/retry";

/**
 * The BACKOFF policy for an external issuer whose load failed — amphora-internal
 * policy, not a consumer knob, so it is deliberately not re-exported from the
 * package index.
 *
 * FLAT, not exponential: the `delay` is supplied by the caller as the amphora's
 * own `refreshInterval`, so a failing issuer is re-attempted on exactly the
 * cadence a healthy one is refreshed on. Growth would buy nothing and cost the
 * one thing that matters here — the RECOVERY-DETECTION WINDOW. A key withdrawn
 * from an issuer whose endpoint was flapping never MISSES (it is cached and
 * still verifies), so only the speculative refetch can retire it; under a
 * growing curve that retirement drifts out to the cap, while a flat floor bounds
 * it to `refreshInterval`.
 *
 * ⚠ `delayMax` is stated rather than defaulted: `computeDelay`'s default cap is
 * 30s, which would silently truncate every `refreshInterval` above it (the
 * 300s default included) and turn a 5-minute floor into a 30-second one. There
 * is no cap to apply here — the caller's `delay` IS the floor.
 *
 * `jitter` keeps its `false` default on purpose: `computeDelay` jitters by
 * multiplying `0.5–1.0`, so it only ever retries SOONER, which is backwards for
 * a floor. And these retries are traffic-triggered rather than timed, so there
 * is no thundering herd for jitter to spread.
 *
 * ⚠ Two retry layers, not to be confused. The Conduit already retries WITHIN one
 * fetch (`createExternalConduit`, `maxAttempts: 3`). This sits ABOVE it: the
 * failure count it feeds counts EXHAUSTED fetches, never HTTP requests.
 */
export const EXTERNAL_RETRY_DELAY: DelayOptions = {
  strategy: "constant",
  delayMax: Infinity,
};
