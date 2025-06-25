# @lindorm/logger

Rich, type-safe wrapper around [winston](https://github.com/winstonjs/winston) that brings

* hierarchical **scopes** (`[ http | router | controller ]`)
* request / transaction **correlation** metadata
* pluggable **filters** for sensitive data (passwords, tokens …)
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

// Mask sensitive data before it reaches the transport
logger.filter('password');          // Replaces value with "[Filtered]"
logger.filter('user.jwt', () => '<jwt>');

http.debug('Login attempt', {
  user: 'alice',
  password: 'super-secret',
  jwt: 'eyJhbGciOi…',
});
```

Readable output will look similar to:

```text
2024-01-01T12:00:00.000Z  DEBUG: Login attempt [ http ]
{
  "user": "alice",
  "password": "[Filtered]",
  "jwt": "<jwt>"
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
* `filter(path, callback?)` – register a runtime filter. If no callback is supplied the value is
  replaced with `"[Filtered]"`.

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
* `Log`, `LogContent`, `LogScope`, `LogCorrelation`
* `LogLevel` – enum of Winston log levels used throughout the package

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE) file for details.

