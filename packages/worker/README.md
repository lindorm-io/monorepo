# @lindorm/worker

Interval-based background worker with retry, jitter, lifecycle events, graceful shutdown, and structured logging.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/worker
```

`@lindorm/logger` is a peer dependency — `LindormWorker` requires an `ILogger` instance.

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

## Subpath Exports

| Export                         | Purpose                             |
| ------------------------------ | ----------------------------------- |
| `@lindorm/worker`              | Main runtime API                    |
| `@lindorm/worker/mocks/jest`   | Jest `createMockWorker()` factory   |
| `@lindorm/worker/mocks/vitest` | Vitest `createMockWorker()` factory |

## Options

```ts
const worker = new LindormWorker({
  // Required
  alias: "my-worker", // identifier used in logs
  interval: "5m", // execution interval (ms or readable time)
  callback: async (ctx) => {
    /* ... */
  }, // main work
  logger, // ILogger from @lindorm/logger

  // Optional
  jitter: "30s", // +/- spread around interval (default: 0)
  callbackTimeout: "2m", // abort callback after this duration (default: disabled)
  errorCallback: async (ctx, err) => {
    /* ... */
  }, // runs after all retries are exhausted
  retry: {
    // override retry defaults
    strategy: "exponential", // "exponential" | "linear" | "constant" (default: "exponential")
    timeout: 250, // initial retry delay ms (default: 250)
    timeoutMax: 30_000, // retry delay cap ms (default: 30000)
    maxAttempts: 10, // retries per interval after the initial call (default: 10)
  },
  listeners: [
    // pre-register event listeners
    { event: "error", listener: (err) => alerting.notify(err) },
  ],
});
```

All time values accept milliseconds or human-readable strings (`"30s"`, `"5m"`, `"1h"`, `"1d"`, `"1w"`).

The constructor throws `LindormWorkerError` when `interval <= 0`, `jitter < 0`, or `callbackTimeout < 0`.

## Lifecycle

```
start() ──> callback ──> [success] ──> wait(interval +/- jitter) ──> callback ──> ...
                │
                └── [error] ──> retry(1) ──> retry(2) ──> ... ──> retry(maxAttempts)
                        │            │                                    │
                     warning      warning                              warning
                     emitted      emitted                              emitted
                                                                          │
                                                                  retry(maxAttempts + 1)
                                                                          │
                                                                       error
                                                                      emitted
                                                                          │
                                                                   errorCallback
                                                                          │
                                                              wait(interval +/- jitter)
```

### Jitter

Jitter is centred around the base interval: `interval + random(-jitter, +jitter)`. With `interval: "10m"` and `jitter: "30s"`, the actual wait is between 9m30s and 10m30s.

### Retry

When the callback throws, the worker retries with a configurable backoff before moving to the next interval. Each failed attempt up to and including `maxAttempts` emits a `warning` event. When the next attempt would exceed `maxAttempts`, an `error` event is emitted and the optional `errorCallback` runs. Errors from `errorCallback` itself are caught and logged at warn level.

### Callback Timeout

When `callbackTimeout` is set, the callback is raced against a deadline. If the callback exceeds the timeout, a `LindormWorkerError` with message `"Callback timed out"` is raised and enters the retry flow.

## Events

```ts
worker.on("start", () => {
  /* worker started */
});
worker.on("stop", () => {
  /* worker stopped */
});
worker.on("success", () => {
  /* callback succeeded */
});
worker.on("warning", (err) => {
  /* callback failed, retrying */
});
worker.on("error", (err) => {
  /* all retries exhausted */
});
```

`warning` and `error` listeners receive a `LindormWorkerError`. Use `off()` to remove a listener and `once()` for one-shot listeners. After `destroy()`, `on()`, `off()`, and `once()` throw.

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

`errorCallback` receives the same context plus the error: `(ctx, err) => Promise<void>`.

## Methods

| Method      | Description                                                                         |
| ----------- | ----------------------------------------------------------------------------------- |
| `start()`   | Begin interval execution. No-op if already started. Throws after `destroy()`.       |
| `stop()`    | Graceful shutdown. Awaits any running callback, then stops.                         |
| `destroy()` | Stop, remove all listeners, mark worker as destroyed. Subsequent calls throw.       |
| `trigger()` | Run the callback immediately (outside the interval loop). Throws after `destroy()`. |
| `health()`  | Returns a `LindormWorkerHealth` snapshot.                                           |

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
worker.running; // boolean — true while the callback is executing
worker.seq; // number — incremented at the start of each interval
worker.latestStart; // Date | null
worker.latestStop; // Date | null
worker.latestSuccess; // Date | null
worker.latestError; // Date | null
worker.latestTry; // Date | null
```

## File Scanner

`LindormWorkerScanner.scan()` discovers workers from a list of file paths, directory paths, and existing `ILindormWorker` instances. Directories are scanned recursively. Files matching `index.*`, `*.fixture.*`, `*.spec.*`, `*.test.*`, or `*.integration.*` are skipped.

For each scanned file, the scanner first checks for an exported `LindormWorker` instance (default or named export). If none is found, it falls back to constructing a `LindormWorker` from CALLBACK-style uppercase exports.

```ts
import { LindormWorkerScanner } from "@lindorm/worker";

const workers = await LindormWorkerScanner.scan(
  [
    "./src/workers", // directory, scanned recursively
    existingWorker, // ILindormWorker instances pass through unchanged
  ],
  logger,
);
```

`scan()` is async and returns `Promise<Array<ILindormWorker>>`.

### CALLBACK-style File

```ts
// workers/CleanupWorker.ts
import type { LindormWorkerCallback } from "@lindorm/worker";
import type { ReadableTime } from "@lindorm/date";
import type { RetryOptions } from "@lindorm/retry";

export const CALLBACK: LindormWorkerCallback = async (ctx) => {
  ctx.logger.info("running cleanup");
};

export const INTERVAL: ReadableTime = "15m";
export const JITTER: ReadableTime = "1m";
export const RETRY: RetryOptions = { maxAttempts: 3, strategy: "linear" };
```

`INTERVAL` is required for CALLBACK-style files. The file's basename is used as the worker `alias` unless an `ALIAS` export is provided.

### Recognised Exports

| Export             | Type                            | Required                               |
| ------------------ | ------------------------------- | -------------------------------------- |
| `CALLBACK`         | `LindormWorkerCallback`         | Yes (when no `LindormWorker` instance) |
| `INTERVAL`         | `ReadableTime \| number`        | Yes (when using `CALLBACK`)            |
| `ALIAS`            | `string`                        | No (defaults to file basename)         |
| `JITTER`           | `ReadableTime \| number`        | No                                     |
| `CALLBACK_TIMEOUT` | `ReadableTime \| number`        | No                                     |
| `ERROR_CALLBACK`   | `LindormWorkerErrorCallback`    | No                                     |
| `LISTENERS`        | `LindormWorkerListenerConfig[]` | No                                     |
| `RETRY`            | `RetryOptions`                  | No                                     |

### Instance-style File

```ts
// workers/SessionWorker.ts
import { LindormWorker } from "@lindorm/worker";

export default new LindormWorker({
  alias: "SessionWorker",
  callback: async () => {
    /* ... */
  },
  interval: "30s",
  logger,
});
```

Either default or named `LindormWorker` exports are picked up. The first instance found in the file wins.

## Errors

| Error                       | Thrown when                                                                                                                 |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `LindormWorkerError`        | Validation failure, callback timeout, or method called after destroy                                                        |
| `LindormWorkerScannerError` | Scanner finds a file with neither a `LindormWorker` instance nor a `CALLBACK` export, or a CALLBACK file missing `INTERVAL` |

Both extend `LindormError` from `@lindorm/errors`.

## Testing

Mock factories are exported under per-runner subpaths so the package itself does not depend on `jest` or `vitest`.

```ts
// Vitest
import { createMockWorker } from "@lindorm/worker/mocks/vitest";

const mock = createMockWorker();

mock.trigger.mockResolvedValue(undefined);
expect(mock.start).toHaveBeenCalled();
```

```ts
// Jest
import { createMockWorker } from "@lindorm/worker/mocks/jest";
```

Each factory returns a `Mocked<ILindormWorker>` (vitest) or `jest.Mocked<ILindormWorker>` (jest). All methods are typed mock functions; `destroy()`, `stop()`, and `trigger()` resolve to `undefined` by default.

## License

AGPL-3.0-or-later
