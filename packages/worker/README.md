# @lindorm/worker

Robust **interval worker** with built-in retry strategy, jitter, lifecycle events and rich logging.
Perfect for background tasks like polling APIs, sending emails, cleaning up data, etc.

---

## Features

* Simple `callback(ctx)` executed on an interval (readable time strings or ms)
* Exponential / linear back-off **retry** with maximum attempts
* Optional **randomisation** (jitter) to avoid thundering-herd problem
* Emits lifecycle events (`start`, `stop`, `success`, `warning`, `error`)
* Supports custom **error handler** that runs after final failed retry
* Exposes latest timestamps & sequence counter for monitoring

---

## Installation

```bash
npm install @lindorm/worker
# or
yarn add @lindorm/worker
```

---

## Quick example

```ts
import { LindormWorker } from '@lindorm/worker';
import { Logger } from '@lindorm/logger';

const worker = new LindormWorker({
  alias: 'cleanup',
  interval: '10m',            // human readable – parsed by @lindorm/date
  randomize: '30s',           // +/- 30s jitter
  retry: {                    // optional
    strategy: 'exponential',
    timeout: 500,             // initial delay
    timeoutMax: 10000,
    maxAttempts: 5,
  },
  logger: new Logger({ readable: true }),

  callback: async (ctx) => {
    // Your business logic
    await ctx.logger.info('Running cleanup');
  },

  errorCallback: async (ctx, err) => {
    ctx.logger.error('Cleanup failed permanently', err);
  },
});

worker.on('warning', (err) => console.warn('retrying after error', err.message));
worker.on('error', (err) => console.error('fatal worker error', err));

worker.start();

// Later …
// worker.stop();
```

---

## API

### Constructor options (partial)

```ts
type LindormWorkerOptions = {
  alias: string;                       // identifier used in logs & metrics
  interval: number | string;           // ms or e.g. '5m'
  randomize?: number | string;         // optional jitter
  retry?: {
    strategy?: 'exponential' | 'linear';
    timeout?: number;                  // base delay
    timeoutMax?: number;               // cap
    maxAttempts?: number;              // default 10
  };
  callback(ctx): Promise<void>;        // main work
  errorCallback?(ctx, err): Promise<void>;
  listeners?: Array<{ event: 'start' | 'stop' | 'success' | 'warning' | 'error'; listener: Function }>;
  logger: ILogger;
};
```

### Instance methods & properties

* `start()` / `stop()` / `trigger()`
* `on(event, listener)` – subscribe to lifecycle events
* `latestStart`, `latestStop`, `latestSuccess`, `latestError`, `latestTry` – `Date | null`
* `running` – boolean, `seq` – incremented on each interval

---

## TypeScript

Full typings for context and listener signatures are included.  The worker depends only on other
Lindorm utility packages and Node built-ins.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

