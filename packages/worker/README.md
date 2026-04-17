# @lindorm/worker

Interval-based background worker with retry, jitter, lifecycle events, graceful shutdown, and structured logging.

## Installation

```bash
npm install @lindorm/worker
```

## Quick Start

```ts
import { LindormWorker } from "@lindorm/worker";

const worker = new LindormWorker({
  alias: "cleanup",
  interval: "10m",
  jitter: "30s",
  logger,

  callback: async (ctx) => {
    ctx.logger.info("Running cleanup", { seq: ctx.seq });
    await db.deleteExpired();
  },
});

worker.start();
```

## Options

```ts
const worker = new LindormWorker({
  // Required
  alias: "my-worker",                 // identifier used in logs
  interval: "5m",                     // execution interval (ms or readable time)
  callback: async (ctx) => { ... },   // main work
  logger: ILogger,                    // @lindorm/logger instance

  // Optional
  jitter: "30s",                      // +/- spread around interval (default: 0)
  callbackTimeout: "2m",              // abort callback after this duration (default: disabled)
  errorCallback: async (ctx, err) => { ... },  // runs after all retries exhausted
  retry: {                            // override retry defaults
    strategy: "exponential",          // "exponential" | "linear" (default: "exponential")
    timeout: 250,                     // initial retry delay ms (default: 250)
    timeoutMax: 30_000,               // retry delay cap ms (default: 30000)
    maxAttempts: 10,                  // retries per interval (default: 10)
  },
  listeners: [                        // pre-register event listeners
    { event: "error", listener: (err) => alerting.notify(err) },
  ],
});
```

All time values accept milliseconds or human-readable strings (`"30s"`, `"5m"`, `"1h"`, `"1d"`, `"1w"`).

## Lifecycle

```
start() ──> callback ──> [success] ──> wait(interval +/- jitter) ──> callback ──> ...
                │
                └── [error] ──> retry(1) ──> retry(2) ──> ... ──> retry(max)
                        │            │                                │
                     warning      warning                           error
                     emitted      emitted                          emitted
                                                                      │
                                                                errorCallback
                                                                      │
                                                          wait(interval +/- jitter)
```

### Jitter

Jitter is centered around the base interval: `interval + random(-jitter, +jitter)`. With `interval: "10m"` and `jitter: "30s"`, the actual wait is between 9m30s and 10m30s.

### Retry

When the callback throws, the worker retries with configurable backoff before moving to the next interval. Each retry emits a `warning` event. When all retries are exhausted, an `error` event is emitted and the optional `errorCallback` runs.

### Callback Timeout

When `callbackTimeout` is set, the callback is raced against a deadline. If the callback exceeds the timeout, it is treated as a failure and enters the retry flow.

## Events

```ts
worker.on("start", () => { ... });            // worker started
worker.on("stop", () => { ... });             // worker stopped
worker.on("success", () => { ... });          // callback succeeded
worker.on("warning", (err) => { ... });       // callback failed, retrying
worker.on("error", (err) => { ... });         // all retries exhausted
```

Use `off()` to remove a listener and `once()` for one-shot listeners.

## Callback Context

The callback receives a context object:

```ts
type LindormWorkerContext = {
  logger: ILogger; // child logger scoped to this execution
  seq: number; // monotonic counter (1, 2, 3, ...)
  latestSuccess: Date | null;
  latestError: Date | null;
  latestTry: Date | null;
};
```

## Methods

| Method      | Description                                               |
| ----------- | --------------------------------------------------------- |
| `start()`   | Begin interval execution. No-op if already started.       |
| `stop()`    | Graceful shutdown. Awaits running callback, then stops.   |
| `destroy()` | Stop + remove all listeners. Methods throw after destroy. |
| `trigger()` | Run the callback immediately (outside the interval).      |
| `health()`  | Returns a `LindormWorkerHealth` snapshot.                 |

### Health Check

```ts
const h = worker.health();
// {
//   alias: "cleanup",
//   started: true,
//   running: false,
//   destroyed: false,
//   seq: 42,
//   latestSuccess: Date,
//   latestError: null,
//   latestTry: Date,
// }
```

## State Getters

```ts
worker.alias; // string
worker.started; // boolean
worker.running; // boolean — true while callback is executing
worker.seq; // number — incremented each interval
worker.latestStart; // Date | null
worker.latestStop; // Date | null
worker.latestSuccess; // Date | null
worker.latestError; // Date | null
worker.latestTry; // Date | null
```

## File Scanner

`LindormWorkerScanner` discovers worker configs from files. Each file exports uppercase named constants:

```ts
// workers/CleanupWorker.ts
import type { LindormWorkerCallback } from "@lindorm/worker";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  await db.deleteExpired();
};

export const INTERVAL = "15m";
export const JITTER = "1m";
export const RETRY = { maxAttempts: 3, strategy: "linear" };
```

Scan a directory to get an array of `ILindormWorker` instances:

```ts
import { LindormWorkerScanner } from "@lindorm/worker";

const workers = LindormWorkerScanner.scan(
  [
    "./src/workers", // directories are scanned recursively
    existingWorker, // LindormWorker instances pass through
  ],
  logger,
);
```

The scanner constructs a `LindormWorker` for every CALLBACK-style file it finds, using the provided logger.

### Recognised Exports

| Export             | Type                            | Required                  |
| ------------------ | ------------------------------- | ------------------------- |
| `CALLBACK`         | `LindormWorkerCallback`         | Yes                       |
| `ALIAS`            | `string`                        | No (defaults to filename) |
| `INTERVAL`         | `ReadableTime \| number`        | No                        |
| `JITTER`           | `ReadableTime \| number`        | No                        |
| `CALLBACK_TIMEOUT` | `ReadableTime \| number`        | No                        |
| `ERROR_CALLBACK`   | `LindormWorkerErrorCallback`    | No                        |
| `LISTENERS`        | `LindormWorkerListenerConfig[]` | No                        |
| `RETRY`            | `RetryOptions`                  | No                        |

## Errors

| Error                       | Thrown when                                                          |
| --------------------------- | -------------------------------------------------------------------- |
| `LindormWorkerError`        | Validation failure, callback timeout, or method called after destroy |
| `LindormWorkerScannerError` | Scanner finds a file without a `CALLBACK` export                     |

Both extend `LindormError` from `@lindorm/errors`.

## Testing

A mock factory is available at `@lindorm/worker/mocks`:

```ts
import { createMockWorker } from "@lindorm/worker/mocks";

const mock = createMockWorker();

mock.trigger.mockResolvedValue(undefined);
expect(mock.start).toHaveBeenCalled();
expect(mock.health).toHaveReturnedWith(expect.objectContaining({ started: false }));
```

All methods are `jest.fn()` instances. `trigger()`, `stop()`, and `destroy()` return resolved promises.

## License

AGPL-3.0-or-later
