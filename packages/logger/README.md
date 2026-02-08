# @lindorm/logger

Rich, type-safe wrapper around [winston](https://github.com/winstonjs/winston) that brings

* hierarchical **scopes** (`[ http | router | controller ]`)
* request / transaction **correlation** metadata
* pluggable **path and key filters** for sensitive data (passwords, tokens …)
* colourised **readable mode** for local development

The implementation is framework-agnostic – the only runtime dependency is Winston – and therefore
fits nicely into any Node.js / TypeScript code-base.

---

## Installation

```bash
npm install @lindorm/logger
# or
yarn add @lindorm/logger
```

---

## Quick start

```ts
import { Logger, LogLevel } from '@lindorm/logger';

// Create a root logger. All child loggers share the same Winston transport.
const logger = new Logger({
  level: LogLevel.Info,                       // minimum log level
  readable: process.env.NODE_ENV !== 'production', // pretty print when not in prod
});

logger.info('Server started');

// Correlate subsequent log lines with a request id
logger.correlation({ requestId: '4711' });

// Narrow the scope – perfect for per-module loggers
const http = logger.child(['http']);

http.verbose('Incoming request', { method: 'GET', url: '/' });

// Mask sensitive data by exact path
logger.filterPath('password');          // Replaces value with "[Filtered]"
logger.filterPath('user.jwt', () => '<jwt>');

// Mask sensitive keys at any depth (including inside arrays)
logger.filterKey('password');                  // matches "password" anywhere in the object tree
logger.filterKey(/token/i);                    // regex: matches accessToken, refreshToken, etc.
logger.filterKey(/secret|credential/i);        // broad security net

http.debug('Login attempt', {
  user: { password: 'super-secret' },   // caught by filterKey("password")
  accessToken: 'eyJhbGciOi…',           // caught by filterKey(/token/i)
});
```

Readable output will look similar to:

```text
2024-01-01T12:00:00.000Z  DEBUG: Login attempt [ http ]
{
  "user": { "password": "[Filtered]" },
  "accessToken": "[Filtered]"
}
```

---

## Public API

### Constructor

```ts
new Logger(options?: {
  level?: LogLevel;   // default: LogLevel.Info
  readable?: boolean; // default: false (JSON output)
});
```

### Logging

* `error(error: Error)`
* `error(message: string, context?, extra?)`
* `warn / info / verbose / debug / silly(message, context?, extra?)`
* `log({ message, level?, context?, extra? })` – low-level helper

### Utilities

* `child(scope?, correlation?)` – returns a new `Logger` that reuses the same Winston transport but
  appends scope / correlation metadata.
* `scope(string[])` – append scope segments to the current instance.
* `correlation(record)` – merge correlation metadata.
* `filterPath(path, callback?)` – register a path-based filter. Matches an exact object path
  (e.g. `"headers.authorization"`). If no callback is supplied the value is replaced with `"[Filtered]"`.
* `filterKey(key, callback?)` – register a key-based filter. Matches a key name at **any depth**,
  including inside arrays. Accepts a string for exact match or a `RegExp` for pattern matching.
* `isLevelEnabled(level)` – returns `true` if the given level would be logged.
* `time()` – returns a `LoggerTimer` handle. Call `.info(message, context?)`, `.debug(…)`, etc.
  on the handle to log with the elapsed duration (ms) included at the top level of the log entry.
* `time(label)` – starts a named timer stored in an internal Map.
* `timeEnd(label, context?, extra?)` – ends the named timer and logs at `"debug"` level.
* `timeEnd(label, level, context?, extra?)` – ends the named timer and logs at the given level.
* `level` – getter / setter for the current minimum log level. Setting it updates all transports.

### Timers

Two timer APIs are available:

**Handle-based** – call `time()` with no arguments to get a `LoggerTimer` handle. Call any log
method on the handle to emit a log entry that includes the elapsed duration.

```ts
const timer = logger.time();

await fetchRemoteData();

timer.info('Remote data fetched', { url });
// → 2024-01-01T12:00:00.000Z  INFO: Remote data fetched (42ms 318µs)

timer.error(new Error('something broke'));
// error(Error) overload works the same as on Logger
```

**Label-based** – pass a label to `time(label)` to start a named timer. End it later with
`timeEnd(label)`. The label is used as the log message.

```ts
logger.time('db-query');

await db.query('SELECT ...');

// defaults to debug level
logger.timeEnd('db-query');

// explicit level + context
logger.time('http-request');
await fetch(url);
logger.timeEnd('http-request', 'info', { url, status: 200 });
```

Child loggers inherit parent timers (via snapshot), so a timer started on a parent can be
ended on a child — but timers started on a child do not leak back to the parent.

### Helper functions

```ts
import { sanitiseAuthorization, sanitiseToken } from '@lindorm/logger';

sanitiseAuthorization('Bearer eyJhbGciOiJ…');
// → 'Bearer eyJhbGciOiJ…eyJ0'   (JWT header + payload only)
```

---

## TypeScript

`@lindorm/logger` is written in TypeScript and ships with declaration files.  Important exports:

* `ILogger` – public logger interface
* `ILoggerTimer` – timer handle interface returned by `time()`
* `Log`, `LogContent`, `LogScope`, `LogCorrelation`
* `LogLevel` – enum of Winston log levels used throughout the package

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE) file for details.

