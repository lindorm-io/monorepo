# @lindorm/retry

Microscopic helper to calculate **back-off delays** for retry logic.  Supports `exponential` (default)
and `linear` strategies with configurable base timeout and maximum cap.

---

## Installation

```bash
npm install @lindorm/retry
# or
yarn add @lindorm/retry
```

No runtime dependencies – the package is literally a single function + enum.

---

## Usage

```ts
import { calculateRetry, RetryStrategy } from '@lindorm/retry';

for (let attempt = 1; attempt <= 5; attempt++) {
  const delay = calculateRetry(attempt, {
    strategy: RetryStrategy.Exponential, // default
    timeout: 200,   // initial delay in ms (default 100)
    timeoutMax: 5000, // absolute upper cap (default 10000)
  });

  console.log('waiting', delay, 'ms');
  await new Promise((r) => setTimeout(r, delay));
}
```

### Linear back-off

```ts
calculateRetry(attempt, { strategy: RetryStrategy.Linear, timeout: 100 });
// delay = attempt * timeout (capped by timeoutMax)
```

---

## API

```ts
function calculateRetry(
  attempt: number,
  options?: {
    strategy?: RetryStrategy; // 'exponential' | 'linear'
    timeout?: number;         // base delay in ms (default 100)
    timeoutMax?: number;      // hard cap (default 10000)
  },
): number;
```

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

