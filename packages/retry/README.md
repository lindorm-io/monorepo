# @lindorm/retry

Tiny back-off and retry helpers for TypeScript: compute a delay for a given attempt, or wrap any async function with automatic retries.

## Installation

```bash
npm install @lindorm/retry
```

This package is ESM-only. Import it with `import`; `require` is not supported.

## Features

- Three back-off strategies: `constant`, `linear`, and `exponential`.
- Optional jitter that scales the delay to 50%–100% of the computed value.
- Configurable base delay, maximum cap, and exponential multiplier.
- `withRetry` wrapper with `maxAttempts`, `isRetryable` predicate, and `onRetry` callback.
- Pure functions only — no timers, sockets, or other side effects beyond `setTimeout` inside `withRetry`.

## Usage

### Wrap an async function

```ts
import { withRetry } from "@lindorm/retry";

const fetchUser = async (id: string) => {
  const res = await fetch(`https://api.example.com/users/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
};

const user = await withRetry(() => fetchUser("abc"), {
  maxAttempts: 5,
  strategy: "exponential",
  delay: 200,
  delayMax: 5000,
  isRetryable: (err) => err instanceof Error && err.message.startsWith("HTTP 5"),
  onRetry: (attempt, err) => console.warn(`retry ${attempt}`, err),
});
```

When `fn` resolves, `withRetry` returns its value. When it rejects, the error is passed to `isRetryable`; if the predicate returns `false` or `maxAttempts` has been reached, the error is rethrown. Otherwise `onRetry` is called and the loop sleeps for the computed delay before the next attempt.

### Compute a delay manually

```ts
import { computeDelay } from "@lindorm/retry";

const delay = computeDelay(3, {
  strategy: "exponential",
  delay: 100,
  delayMax: 10000,
  multiplier: 2,
  jitter: false,
});
// 400 ms — 100 * 2^(3-1)
```

### Legacy helper

```ts
import { calculateRetry } from "@lindorm/retry";

const ms = calculateRetry(2, { strategy: "linear", timeout: 250, timeoutMax: 5000 });
// 500 ms — 250 * 2
```

`calculateRetry` is a thin wrapper around `computeDelay` kept for backwards compatibility. It uses `timeout`/`timeoutMax` instead of `delay`/`delayMax`, hard-codes `multiplier = 2` and `jitter = false`, and defaults `timeoutMax` to `10000`. Prefer `computeDelay` in new code.

## API

### `withRetry<T>(fn, options?)`

```ts
const withRetry: <T>(fn: () => Promise<T>, options?: WithRetryOptions) => Promise<T>;
```

Invokes `fn` up to `maxAttempts` times, sleeping between failures.

`WithRetryOptions`:

| Option        | Type                                        | Default         | Notes                                                          |
| ------------- | ------------------------------------------- | --------------- | -------------------------------------------------------------- |
| `maxAttempts` | `number`                                    | `3`             | Total attempts including the first call.                       |
| `strategy`    | `"constant" \| "linear" \| "exponential"`   | `"exponential"` | Passed through to `computeDelay`.                              |
| `delay`       | `number`                                    | `100`           | Base delay in ms, passed through to `computeDelay`.            |
| `delayMax`    | `number`                                    | `30000`         | Hard cap in ms, passed through to `computeDelay`.              |
| `multiplier`  | `number`                                    | `2`             | Exponential multiplier, passed through to `computeDelay`.      |
| `jitter`      | `boolean`                                   | `true`          | When `true`, scales delay to 50%–100% of the computed value.   |
| `isRetryable` | `(error: unknown) => boolean`               | `() => true`    | Return `false` to rethrow immediately without further retries. |
| `onRetry`     | `(attempt: number, error: unknown) => void` | `undefined`     | Invoked after each failure that will be retried.               |

### `computeDelay(attempt, options?)`

```ts
const computeDelay: (attempt: number, options?: DelayOptions) => number;
```

Returns the delay in milliseconds for the given 1-indexed attempt.

`DelayOptions`:

| Option       | Type                                      | Default         |
| ------------ | ----------------------------------------- | --------------- |
| `strategy`   | `"constant" \| "linear" \| "exponential"` | `"exponential"` |
| `delay`      | `number`                                  | `100`           |
| `delayMax`   | `number`                                  | `30000`         |
| `multiplier` | `number`                                  | `2`             |
| `jitter`     | `boolean`                                 | `false`         |

Formulas before capping and jitter:

- `constant`: `delay`
- `linear`: `delay * attempt`
- `exponential`: `delay * multiplier^(attempt - 1)`

The result is then capped at `delayMax`. When `jitter` is `true`, the capped value is multiplied by a uniform random factor in `[0.5, 1.0]` and rounded.

### `calculateRetry(attempt, options?)`

```ts
const calculateRetry: (attempt: number, options?: Partial<RetryOptions>) => number;
```

Legacy wrapper around `computeDelay`. Accepts `strategy`, `timeout` (default `100`), and `timeoutMax` (default `10000`). Always uses `multiplier = 2` and `jitter = false`.

### Types

```ts
type RetryStrategy = "exponential" | "linear" | "constant";

type RetryConfig = {
  maxAttempts: number;
  strategy: RetryStrategy;
  timeout: number;
  timeoutMax: number;
};

type RetryOptions = Optional<
  RetryConfig,
  "maxAttempts" | "strategy" | "timeout" | "timeoutMax"
>;

type DelayOptions = {
  strategy?: RetryStrategy;
  delay?: number;
  delayMax?: number;
  multiplier?: number;
  jitter?: boolean;
};

type WithRetryOptions = {
  maxAttempts?: number;
  strategy?: RetryStrategy;
  delay?: number;
  delayMax?: number;
  multiplier?: number;
  jitter?: boolean;
  isRetryable?: (error: unknown) => boolean;
  onRetry?: (attempt: number, error: unknown) => void;
};
```

`RetryStrategy` is a string union, not an enum — pass the literal `"exponential"`, `"linear"`, or `"constant"`.

## License

AGPL-3.0-or-later. See [LICENSE](https://github.com/lindorm-io/monorepo/blob/main/LICENSE).
