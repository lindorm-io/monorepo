# @lindorm/breaker

Protocol-agnostic circuit breaker for Node.js with sliding-window failure tracking, exponential backoff, configurable error classification, and EventEmitter-based state notifications.

This package is **ESM-only**. Use `import`, not `require`.

## Installation

```bash
npm install @lindorm/breaker
```

## Quick Start

```ts
import { CircuitBreaker, CircuitOpenError } from "@lindorm/breaker";

const breaker = new CircuitBreaker({
  name: "payments-api",
  threshold: 5,
  window: 60_000,
});

try {
  const result = await breaker.execute(() =>
    fetch("https://api.payments.example/charge"),
  );
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Fast-fail: too many recent failures
  }
  throw error;
}
```

## Features

- Three-state circuit (`closed`, `open`, `half-open`) with `execute()` as the single entry point.
- Sliding time window for transient-failure counting.
- Exponential backoff between probe attempts, with a configurable cap.
- Pluggable error classifier — categorise each error as `transient`, `permanent`, or `ignorable`.
- EventEmitter-based notifications on every state transition.
- Probe coalescing — concurrent calls in `half-open` share a single probe and only one underlying invocation runs.
- Manual controls (`open()`, `close()`, `reset()`) for integration with external health signals.
- Jest and Vitest mock factories for unit tests.

## How It Works

The breaker tracks failures within a sliding time window. When the count of `transient` failures reaches the configured threshold, the circuit opens and subsequent calls fail immediately with `CircuitOpenError`. After a backoff delay, the next call is admitted as a probe and the circuit moves to `half-open`. If the probe succeeds, the circuit closes. If it fails, the circuit re-opens with an exponentially increasing delay before the next probe.

```
closed ──[threshold reached]──> open ──[delay elapsed]──> half-open
  ^                                                          │
  └─────────[probe succeeds]──────────────────────────────────┘
                                                             │
  open <────[probe fails]─────────────────────────────────────┘
```

While the breaker is in `half-open` and a probe is in flight, additional `execute()` calls do not run their function — they wait for the probe to settle and then re-enter `execute()` against the resulting state.

## Options

```ts
import { CircuitBreaker } from "@lindorm/breaker";

const breaker = new CircuitBreaker({
  // Required
  name: "my-service",

  // Optional (defaults shown)
  classifier: () => "transient",
  threshold: 5,
  window: 60_000,
  halfOpenDelay: 30_000,
  halfOpenBackoff: 2,
  halfOpenMaxDelay: 300_000,
});
```

| Option             | Type                                    | Default       | Description                                                               |
| ------------------ | --------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `name`             | `string`                                | —             | Identifier emitted on every state-change event. Required.                 |
| `classifier`       | `(error: Error) => ErrorClassification` | all transient | Decides how each thrown error affects breaker state.                      |
| `threshold`        | `number`                                | `5`           | Count of `transient` failures within `window` that trips the circuit.     |
| `window`           | `number` (ms)                           | `60_000`      | Sliding-window duration used for transient-failure counting.              |
| `halfOpenDelay`    | `number` (ms)                           | `30_000`      | Base delay after opening before the first probe is admitted.              |
| `halfOpenBackoff`  | `number`                                | `2`           | Multiplier applied per failed probe: `delay = halfOpenDelay * backoff^n`. |
| `halfOpenMaxDelay` | `number` (ms)                           | `300_000`     | Upper bound on the computed probe delay.                                  |

## Error Classification

The `classifier` decides how each error from `execute()` affects the breaker:

| Classification | Behaviour                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| `"transient"`  | Recorded in the sliding window. Circuit opens when count reaches threshold. |
| `"permanent"`  | Circuit opens immediately, regardless of threshold.                         |
| `"ignorable"`  | Error is re-thrown to the caller but does not affect breaker state.         |

In every case the original error is re-thrown unchanged — the breaker never wraps caller errors.

```ts
import { CircuitBreaker, type ErrorClassification } from "@lindorm/breaker";

const classify = (error: Error): ErrorClassification => {
  if (error.message.includes("ECONNREFUSED")) return "permanent";
  if (error.message.includes("404")) return "ignorable";
  return "transient";
};

const breaker = new CircuitBreaker({ name: "api", classifier: classify });
```

## Events

The breaker emits an event on every state transition. Each listener receives a `StateChangeEvent`:

```ts
type StateChangeEvent = {
  name: string;
  from: CircuitBreakerState;
  to: CircuitBreakerState;
  failures: number;
  timestamp: number;
};
```

The event name matches the destination state — `"open"`, `"half-open"`, or `"closed"`. Listeners are independent, so logging, metrics, and alerting can subscribe separately.

```ts
breaker.on("open", (event) => {
  logger.warn("Circuit opened", { name: event.name, failures: event.failures });
});

breaker.on("half-open", (event) => {
  logger.debug("Circuit probing", { name: event.name });
});

breaker.on("closed", (event) => {
  logger.info("Circuit recovered", { name: event.name });
});
```

A no-op transition (e.g. calling `open()` while already open) does not emit.

## Manual Control

```ts
breaker.open();
breaker.close();
breaker.reset();
```

| Method    | From                 | To          | Notes                                                                                 |
| --------- | -------------------- | ----------- | ------------------------------------------------------------------------------------- |
| `open()`  | `closed`/`half-open` | `open`      | Resets the sliding window and probe-attempt counter. No-op if `open`.                 |
| `close()` | `open`               | `half-open` | Resets probe-attempt counter; next `execute()` runs as the probe. No-op otherwise.    |
| `reset()` | any                  | `closed`    | Clears window, probe-attempt counter, and unblocks any waiters on an in-flight probe. |

`open()` is misleadingly named at first glance — it transitions _to_ the open state. Likewise `close()` does not move directly to `closed`; it only opens up a half-open probe attempt. Use `reset()` to force the breaker fully closed.

## State Getters

```ts
breaker.name; // string
breaker.state; // "closed" | "open" | "half-open"
breaker.isClosed; // boolean
breaker.isOpen; // boolean
breaker.isHalfOpen; // boolean
```

## Errors

| Error              | Thrown when                                                                                   |
| ------------------ | --------------------------------------------------------------------------------------------- |
| `CircuitOpenError` | `execute()` is called while the circuit is open and the probe delay has not elapsed.          |
| `BreakerError`     | Base class; `CircuitOpenError` extends it. Both extend `LindormError` from `@lindorm/errors`. |

`CircuitOpenError` carries a `debug` payload with the breaker `name`, current `state`, and `failures` count at the time of rejection.

## API Reference

```ts
class CircuitBreaker implements ICircuitBreaker {
  constructor(options: CircuitBreakerOptions);

  readonly name: string;
  readonly state: CircuitBreakerState;
  readonly isClosed: boolean;
  readonly isOpen: boolean;
  readonly isHalfOpen: boolean;

  execute<T>(fn: () => Promise<T>): Promise<T>;
  open(): void;
  close(): void;
  reset(): void;
  on(
    event: "open" | "half-open" | "closed",
    listener: (event: StateChangeEvent) => void,
  ): void;
}
```

| Export                  | Kind      | Description                                                                     |
| ----------------------- | --------- | ------------------------------------------------------------------------------- |
| `CircuitBreaker`        | class     | Concrete circuit-breaker implementation.                                        |
| `ICircuitBreaker`       | interface | Public contract implemented by `CircuitBreaker` and the test mocks.             |
| `BreakerError`          | class     | Base error class for this package.                                              |
| `CircuitOpenError`      | class     | Thrown by `execute()` when the circuit is open and probe delay has not elapsed. |
| `CircuitBreakerOptions` | type      | Constructor options shape.                                                      |
| `CircuitBreakerState`   | type      | `"closed" \| "open" \| "half-open"`.                                            |
| `ErrorClassification`   | type      | `"transient" \| "permanent" \| "ignorable"`.                                    |
| `ErrorClassifier`       | type      | `(error: Error) => ErrorClassification`.                                        |
| `StateChangeEvent`      | type      | Payload passed to event listeners.                                              |
| `StateChangeListener`   | type      | `(event: StateChangeEvent) => void`.                                            |

## Testing

Mock factories are exported from sub-paths so test runners pick the matching module:

```ts
// Jest
import { createMockCircuitBreaker } from "@lindorm/breaker/mocks/jest";

// Vitest
import { createMockCircuitBreaker } from "@lindorm/breaker/mocks/vitest";
```

The factory returns an object that implements `ICircuitBreaker`. `execute`, `open`, `close`, `reset`, and `on` are mock functions; the readonly state fields default to `name: "mock"`, `state: "closed"`, `isClosed: true`, `isOpen: false`, `isHalfOpen: false`. The default `execute` implementation invokes the supplied function as-is.

```ts
import { CircuitOpenError } from "@lindorm/breaker";
import { createMockCircuitBreaker } from "@lindorm/breaker/mocks/vitest";

const mock = createMockCircuitBreaker();

mock.execute.mockRejectedValue(new CircuitOpenError("open"));

await expect(subject(mock)).rejects.toBeInstanceOf(CircuitOpenError);
expect(mock.on).toHaveBeenCalledWith("open", expect.any(Function));
```

## License

AGPL-3.0-or-later
