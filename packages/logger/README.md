# @lindorm/logger

Type-safe Winston wrapper with hierarchical scopes, correlation metadata, and pluggable filters for sensitive data.

## Installation

```bash
npm install @lindorm/logger
```

This package is ESM-only — use `import`, not `require`.

## Features

- Typed log methods (`error`, `warn`, `info`, `verbose`, `debug`, `silly`) plus a low-level `log()` helper.
- Hierarchical `child()` loggers that share a single Winston transport but layer their own scope and correlation metadata.
- `filterPath` (exact dotted path) and `filterKey` (string or regex, any depth, including inside arrays) for redacting sensitive fields.
- Two timer APIs: a `time()` handle and label-based `time(label)` / `timeEnd(label)`. Child loggers receive a snapshot of parent-started labelled timers.
- Automatic Error extraction — passing an `Error` (or `{ cause }` chain) expands into `error`, `name`, `message`, `stack`, and recursive `cause` data.
- Readable colourised output for development; structured JSON output by default.
- Drop-in mock factories for Jest and Vitest.
- Helpers for sanitising JWT/JWE tokens and `Authorization` headers.

## Quick start

```ts
import { Logger } from "@lindorm/logger";

const logger = new Logger({
  level: "info",
  readable: process.env.NODE_ENV !== "production",
});

logger.info("Server started");

logger.correlation({ requestId: "4711" });

const http = logger.child(["http"]);
http.verbose("Incoming request", { method: "GET", url: "/" });

logger.filterPath("password");
logger.filterPath("user.jwt", () => "<jwt>");

logger.filterKey("password");
logger.filterKey(/token/i);

http.debug("Login attempt", {
  user: { password: "super-secret" },
  accessToken: "eyJhbGciOi…",
});
```

## Logger

### Constructor

```ts
new Logger(options?: LoggerOptions);
```

`LoggerOptions`:

| Field         | Type             | Default  | Description                                                                                 |
| ------------- | ---------------- | -------- | ------------------------------------------------------------------------------------------- |
| `level`       | `LogLevel`       | `"info"` | Minimum log level. One of `"error" \| "warn" \| "info" \| "verbose" \| "debug" \| "silly"`. |
| `readable`    | `boolean`        | `false`  | When `true`, prints colourised human-readable output instead of JSON.                       |
| `correlation` | `LogCorrelation` | `{}`     | Initial correlation metadata. Keys are camel-cased on assignment.                           |
| `scope`       | `LogScope`       | `[]`     | Initial scope segments.                                                                     |
| `filters`     | `LogFilters`     | `{}`     | Pre-registered path filters keyed by exact dotted path.                                     |

### Logging methods

```ts
logger.error(error: Error): void;
logger.error(message: string, context?: LogContent, extra?: Array<LogContent>): void;

logger.warn(message: string, context?: LogContent, extra?: Array<LogContent>): void;
logger.info(message: string, context?: LogContent, extra?: Array<LogContent>): void;
logger.verbose(message: string, context?: LogContent, extra?: Array<LogContent>): void;
logger.debug(message: string, context?: LogContent, extra?: Array<LogContent>): void;
logger.silly(message: string, context?: LogContent, extra?: Array<LogContent>): void;

logger.log({ message, level?, context?, extra? }: Log): void;
```

`log()` defaults the level to `"info"` when omitted. `LogContent` accepts a plain object, an `Error`, `null`, or `undefined`.

### Scope and correlation

```ts
logger.scope(["http", "controller"]);
logger.correlation({ requestId: "4711", userId: 42 });

const child = logger.child(["router"]);
const childWithCorrelation = logger.child({ traceId: "abc" });
```

`scope()` and `correlation()` mutate the current logger; `child()` returns a new logger that shares the underlying Winston transport but layers additional scope/correlation on top. Scope segments are trimmed and camel-cased; correlation keys are camel-cased.

### Filters

```ts
logger.filterPath("user.password");
logger.filterPath("headers.authorization", (v) => `redacted(${v.length})`);

logger.filterKey("password");
logger.filterKey(/token/i, () => "[Token]");
```

`filterPath` matches a single exact dotted path (via `object-path`). `filterKey` matches a key name at any depth, including inside arrays — pass either a string (exact match) or a `RegExp` (pattern match). Both default to replacing the matched value with `"[Filtered]"` if no callback is supplied.

### Timers

Handle-based timer — `time()` with no label:

```ts
const timer = logger.time();
await fetchRemoteData();
timer.info("Remote data fetched", { url });
```

The returned `LoggerTimer` exposes `error`, `warn`, `info`, `verbose`, `debug`, and `silly` with the same signatures as the logger; each call emits one entry that includes the elapsed `duration`.

Label-based timer — `time(label)` / `timeEnd(label)`:

```ts
logger.time("db-query");
await db.query("SELECT ...");
logger.timeEnd("db-query");

logger.time("http-request");
await fetch(url);
logger.timeEnd("http-request", "info", { url, status: 200 });
```

`timeEnd(label)` defaults to `"debug"` level and uses the label as the message. Calling `timeEnd` on an unknown label emits a warning instead. `child()` snapshots the parent's labelled timers, so a label started on a parent can be ended on the child, but a label started on a child does not propagate back to the parent.

### Other methods

```ts
logger.isLevelEnabled(level: LogLevel): boolean;
logger.level;          // getter — current minimum level
logger.level = "debug"; // setter — updates all transports
```

### Static console helper

`Logger.std` is a typed `StdLogger` that prints coloured output via the global `console`:

```ts
import { Logger } from "@lindorm/logger";

Logger.std.info("ready");
Logger.std.success("done");
Logger.std.error("fail");
```

## Utilities

```ts
import { inspectDictionary, sanitiseAuthorization, sanitiseToken } from "@lindorm/logger";

inspectDictionary(obj, colors?, depth?); // util.inspect with sane defaults

sanitiseAuthorization("Bearer eyJhbGciOiJ….a.b"); // → "Bearer eyJhbGciOiJ….a"
sanitiseAuthorization("Basic dXNlcjpwYXNz");      // → "Basic [Filtered]"

sanitiseToken("a.b.c");     // → "a.b"  (JWT: header + payload only)
sanitiseToken("a.b.c.d.e"); // → "a"    (JWE: header only)
```

## Mocks

Drop-in mock factories live behind dedicated subpaths to avoid loading the test runner at runtime.

Vitest:

```ts
import { createMockLogger } from "@lindorm/logger/mocks/vitest";

const logger = createMockLogger();
```

Jest:

```ts
import { createMockLogger } from "@lindorm/logger/mocks/jest";

const logger = createMockLogger();
```

Both factories return a fully-typed mocked `ILogger` with `child()` returning further mocks and `time()` returning a mocked `ILoggerTimer`. An optional `logFn` callback receives every log call for assertions.

## Types

`@lindorm/logger` ships with declaration files. Public type exports include:

- `ILogger`, `ILoggerTimer` — interfaces
- `Logger`, `LoggerTimer` — classes
- `LoggerOptions`, `Log`, `LogContent`, `LogCorrelation`, `LogScope`, `LogFilters`, `LogLevel`
- `FilterCallback`, `StdLogger`, `TimerLogFn`

Note: `LogLevel` is a string union (`"error" | "warn" | ... | "silly"`), not an enum.

## License

AGPL-3.0-or-later
