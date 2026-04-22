/**
 * Structured reason attached to a Lindorm-originated AbortSignal.
 *
 * Pylon sets this on the controller when it aborts a request-scoped
 * signal; downstream consumers MAY inspect `signal.reason` for logs
 * and telemetry. Consumers MUST tolerate arbitrary reasons — including
 * `undefined` and values produced outside the lindorm ecosystem (e.g.
 * `AbortSignal.timeout(...)`).
 */
export type AbortReason =
  | { kind: "client-disconnect"; correlationId?: string; requestId?: string }
  | { kind: "request-timeout"; timeoutMs: number }
  | { kind: "server-shutdown" }
  | { kind: "parent-aborted"; cause?: unknown }
  | { kind: "rate-limit-exceeded"; key?: string }
  | { kind: "breaker-open"; breakerName?: string }
  | { kind: "manual"; message?: string };

/**
 * Mixin for consumer option types that observe a signal. Always
 * optional — absence means the operation runs to completion.
 */
export type WithSignal<T> = T & { signal?: AbortSignal };
