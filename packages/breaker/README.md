# @lindorm/breaker

Protocol-agnostic circuit breaker for Node.js with sliding time windows, exponential backoff, error classification, and EventEmitter-based state notifications.

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
  const result = await breaker.execute(() => fetch("https://api.payments.com/charge"));
} catch (error) {
  if (error instanceof CircuitOpenError) {
    // Fast-fail: too many recent failures
  }
  throw error;
}
```

## How It Works

The breaker tracks failures within a sliding time window. When failures reach the threshold, the circuit opens and subsequent calls fail immediately with `CircuitOpenError`. After a cooldown delay, the breaker enters a half-open state where a single probe request is allowed through. If the probe succeeds, the circuit closes. If it fails, the circuit re-opens with an exponentially increasing delay before the next probe.

```
closed ──[threshold reached]──> open ──[delay elapsed]──> half-open
  ^                                                          │
  └─────────[probe succeeds]──────────────────────────────────┘
                                                             │
  open <────[probe fails]─────────────────────────────────────┘
```

While in half-open state, concurrent callers wait for the in-flight probe to resolve rather than executing duplicate probes.

## Options

```ts
const breaker = new CircuitBreaker({
  // Required
  name: "my-service",

  // Optional (defaults shown)
  classifier: (error) => "transient", // error classification function
  threshold: 5, // failures within window to trip
  window: 60_000, // sliding window duration (ms)
  halfOpenDelay: 30_000, // initial delay before first probe (ms)
  halfOpenBackoff: 2, // backoff multiplier for subsequent probes
  halfOpenMaxDelay: 300_000, // maximum probe delay cap (ms)
});
```

## Error Classification

The `classifier` function determines how each error affects the breaker:

| Classification | Behaviour                                                                  |
| -------------- | -------------------------------------------------------------------------- |
| `"transient"`  | Counted in the sliding window. Circuit opens when count reaches threshold. |
| `"permanent"`  | Circuit opens immediately, regardless of threshold.                        |
| `"ignorable"`  | Error is re-thrown to the caller but does not affect the breaker state.    |

```ts
import type { ErrorClassification } from "@lindorm/breaker";

const breaker = new CircuitBreaker({
  name: "api",
  classifier: (error: Error): ErrorClassification => {
    if (error.message.includes("ECONNREFUSED")) return "permanent";
    if (error.message.includes("404")) return "ignorable";
    return "transient";
  },
});
```

## Events

The breaker emits events on state transitions via an EventEmitter interface. Each listener receives a `StateChangeEvent`:

```ts
type StateChangeEvent = {
  name: string; // breaker name
  from: CircuitBreakerState; // previous state
  to: CircuitBreakerState; // new state
  failures: number; // failure count at time of transition
  timestamp: number; // Date.now() at time of transition
};
```

Subscribe to specific transitions:

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

Multiple listeners can be registered independently, making it straightforward to separate concerns like logging, metrics, and alerting.

## Manual Control

```ts
// Force open (e.g. external health check failed)
breaker.open();

// Move from open to half-open (e.g. dependency reconnected)
breaker.close();

// Reset to closed and clear all failure history
breaker.reset();
```

| Method    | From               | To        | Notes                                      |
| --------- | ------------------ | --------- | ------------------------------------------ |
| `open()`  | closed / half-open | open      | Resets window and backoff                  |
| `close()` | open               | half-open | Next `execute()` runs as probe             |
| `reset()` | any                | closed    | Clears window, backoff, and pending probes |

## State Getters

```ts
breaker.name; // string
breaker.state; // "closed" | "open" | "half-open"
breaker.isClosed; // boolean
breaker.isOpen; // boolean
breaker.isHalfOpen; // boolean
```

## Errors

| Error              | Thrown when                                                                         |
| ------------------ | ----------------------------------------------------------------------------------- |
| `CircuitOpenError` | `execute()` is called while the circuit is open and the probe delay has not elapsed |
| `BreakerError`     | Base error class (parent of `CircuitOpenError`)                                     |

Both extend `LindormError` from `@lindorm/errors`.

## Testing

A mock factory is available at `@lindorm/breaker/mocks`:

```ts
import { createMockCircuitBreaker } from "@lindorm/breaker/mocks";

const mock = createMockCircuitBreaker();

// All methods are jest.fn() instances
mock.execute.mockRejectedValue(new CircuitOpenError("open"));
expect(mock.on).toHaveBeenCalledWith("open", expect.any(Function));
```

## License

AGPL-3.0-or-later
