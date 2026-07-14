# @lindorm/errors

Structured error classes with HTTP status codes, error chaining, and JSON serialisation.

## Installation

```bash
npm install @lindorm/errors
```

This package is **ESM-only**. Use `import` syntax — `require()` is not supported.

## Features

- `LindormError` base class extending the native `Error`, carrying a UUID, optional code, separate `data` and `debug` dictionaries, details, support contact, title, status, and timestamp
- Error wrapping that inherits id, code, data, debug, details, status, support, title, and timestamp from a wrapped `LindormError`, and accumulates a chain of `Name: message` strings in `errors`
- `ClientError` subclass with HTTP 4xx status codes and matching titles, defaulting to `400 Bad Request`
- `ServerError` subclass with HTTP 5xx status codes and matching titles, defaulting to `500 Internal Server Error`
- `AbortError` subclass for cancelled operations, defaulting to status `499 Client Closed Request` and carrying an arbitrary `reason`
- `toJSON()` returning a stable, fully-typed `LindormErrorAttributes` shape suitable for logging or API responses
- `errorRegistry` resolving a serialised error back to its original class, so an error that crossed a wire is still catchable with `instanceof`

## Quick Start

```typescript
import { ClientError, LindormError, ServerError } from "@lindorm/errors";

throw new ClientError("Email is required", {
  code: "MISSING_EMAIL",
  status: ClientError.Status.BadRequest,
  data: { field: "email" },
});

throw new ServerError("Upstream call failed", {
  code: "UPSTREAM_FAILED",
  status: ServerError.Status.BadGateway,
  debug: { url: "https://example.com/api" },
});

const wrap = (cause: Error) =>
  new LindormError("Operation failed", { error: cause, code: "OP_FAILED" });
```

## LindormError

The base class. Extends `Error` and adds the following readonly properties.

| Property    | Type                       | Notes                                                         |
| ----------- | -------------------------- | ------------------------------------------------------------- |
| `id`        | `string`                   | Generated via `randomUUID()` when not provided                |
| `code`      | `string \| number \| null` | Optional error code, accepts string or number                 |
| `data`      | `Dict`                     | User-facing data, merged with `data` from a wrapped error     |
| `debug`     | `Dict`                     | Internal debug data, merged with `debug` from a wrapped error |
| `details`   | `string \| null`           | Long-form description                                         |
| `errors`    | `Array<string>`            | Chain of `Name: message` strings from wrapped errors          |
| `status`    | `number`                   | Defaults to `-1` on `LindormError`; subclasses set their own  |
| `support`   | `string \| null`           | Support contact info                                          |
| `title`     | `string \| null`           | Short title                                                   |
| `timestamp` | `Date`                     | Set at construction, or inherited from a wrapped LindormError |

### Constructor

```typescript
new LindormError(message: string, options?: LindormErrorOptions)
```

`LindormErrorOptions`:

| Option    | Type               | Description                                                      |
| --------- | ------------------ | ---------------------------------------------------------------- |
| `id`      | `string`           | Override the auto-generated UUID                                 |
| `code`    | `string \| number` | Error code                                                       |
| `data`    | `Dict`             | User-facing data                                                 |
| `debug`   | `Dict`             | Debug data                                                       |
| `details` | `string`           | Long-form description                                            |
| `error`   | `Error`            | Error to wrap; its stack, attributes, and identity are inherited |
| `status`  | `number`           | Numeric status                                                   |
| `support` | `string`           | Support contact info                                             |
| `title`   | `string`           | Short title                                                      |

### Wrapping behaviour

When `options.error` is provided:

- `stack` is taken from the wrapped error
- `errors` is seeded from the wrapped error's `errors` (if it is itself a `LindormError`), then `${wrapped.name}: ${wrapped.message}` is pushed
- `id`, `code`, `details`, `status`, `support`, `title`, and `timestamp` fall back to the wrapped error's values when not set on the new error
- `data` and `debug` are spread from the wrapped error first, then the new options on top

```typescript
import { LindormError, ServerError } from "@lindorm/errors";

const inner = new Error("connection refused");
const middle = new ServerError("Query failed", { error: inner });
const outer = new LindormError("Get user failed", { error: middle });

outer.errors;
// ["Error: connection refused", "ServerError: Query failed"]
```

### `toJSON()`

```typescript
const error = new LindormError("Boom");
error.toJSON();
```

Returns a `LindormErrorAttributes` object with `id`, `code`, `data`, `debug`, `details`, `errors`, `message`, `name`, `stack`, `status`, `support`, `title`, and `timestamp`.

## ClientError

`ClientError` extends `LindormError` and represents 4xx responses. The status defaults to `ClientError.Status.BadRequest` (400). The `title` is auto-derived from the status (e.g. `404` → `"Not Found"`) unless you pass one explicitly.

```typescript
import { ClientError } from "@lindorm/errors";

throw new ClientError("User not found", {
  status: ClientError.Status.NotFound,
  code: "USER_NOT_FOUND",
  data: { userId },
});
```

### `ClientError.Status`

A static enum of supported 4xx codes.

| Member                            | Value |
| --------------------------------- | ----- |
| `BadRequest`                      | 400   |
| `Unauthorized`                    | 401   |
| `PaymentRequired`                 | 402   |
| `Forbidden`                       | 403   |
| `NotFound`                        | 404   |
| `MethodNotAllowed`                | 405   |
| `NotAcceptable`                   | 406   |
| `ProxyAuthenticationRequired`     | 407   |
| `RequestTimeout`                  | 408   |
| `Conflict`                        | 409   |
| `Gone`                            | 410   |
| `LengthRequired`                  | 411   |
| `PreconditionFailed`              | 412   |
| `PayloadTooLarge`                 | 413   |
| `RequestUriTooLong`               | 414   |
| `UnsupportedMediaType`            | 415   |
| `RequestedRangeNotSatisfiable`    | 416   |
| `ExpectationFailed`               | 417   |
| `ImATeapot`                       | 418   |
| `MisdirectedRequest`              | 421   |
| `UnprocessableEntity`             | 422   |
| `Locked`                          | 423   |
| `FailedDependency`                | 424   |
| `UpgradeRequired`                 | 426   |
| `PreconditionRequired`            | 428   |
| `TooManyRequests`                 | 429   |
| `RequestHeaderFieldsTooLarge`     | 431   |
| `ConnectionClosedWithoutResponse` | 444   |
| `UnavailableForLegalReasons`      | 451   |
| `ClientClosedRequest`             | 499   |

## ServerError

`ServerError` extends `LindormError` and represents 5xx responses. The status defaults to `ServerError.Status.InternalServerError` (500). The `title` is auto-derived from the status unless one is supplied.

```typescript
import { ServerError } from "@lindorm/errors";

throw new ServerError("Database unreachable", {
  status: ServerError.Status.ServiceUnavailable,
  code: "DB_UNAVAILABLE",
  debug: { host, port },
});
```

### `ServerError.Status`

| Member                          | Value |
| ------------------------------- | ----- |
| `InternalServerError`           | 500   |
| `NotImplemented`                | 501   |
| `BadGateway`                    | 502   |
| `ServiceUnavailable`            | 503   |
| `GatewayTimeout`                | 504   |
| `HttpVersionNotSupported`       | 505   |
| `VariantAlsoNegotiates`         | 506   |
| `InsufficientStorage`           | 507   |
| `LoopDetected`                  | 508   |
| `NotExtended`                   | 510   |
| `NetworkAuthenticationRequired` | 511   |
| `NetworkConnectTimeoutError`    | 599   |

## AbortError

`AbortError` extends `LindormError` for cancelled or aborted operations. The default message is `"Operation aborted"`, the default status is `499`, and the default title is `"Client Closed Request"`. All defaults are overridable through the same `LindormErrorOptions`, plus an extra `reason` field.

```typescript
import { AbortError } from "@lindorm/errors";

const abort = (signal: AbortSignal) => {
  if (signal.aborted) {
    throw new AbortError("Request cancelled", { reason: signal.reason });
  }
};
```

`AbortErrorOptions` extends `LindormErrorOptions` with:

| Option   | Type      | Description                                        |
| -------- | --------- | -------------------------------------------------- |
| `reason` | `unknown` | Free-form reason; commonly an `AbortSignal.reason` |

`AbortError` exposes the supplied `reason` as a readonly property of the same type.

## Subclassing

Extend the base classes for domain-specific errors. Re-use the parent's options shape so callers can still set `data`, `debug`, etc.

```typescript
import { ClientError, type LindormErrorOptions } from "@lindorm/errors";

export class AuthenticationError extends ClientError {
  public constructor(message: string, options: LindormErrorOptions = {}) {
    super(message, {
      ...options,
      status: ClientError.Status.Unauthorized,
      code: options.code ?? "AUTH_FAILED",
    });
  }
}
```

## Error Registry

`errorRegistry` is a process-wide map from error **names** and HTTP **statuses** back to error classes. It exists so an error that crossed a wire can be rebuilt as the class it was thrown as — which is what lets a caller write `catch (e) { if (e instanceof UserSuspendedError) }` instead of picking apart a status code and a string.

Every class in this package registers itself on import. Register your own the same way:

```typescript
import { errorRegistry, ForbiddenError } from "@lindorm/errors";

export class UserSuspendedError extends ForbiddenError {
  public constructor(message: string, options = {}) {
    super(message, { code: "USER_SUSPENDED", ...options });
  }
}

errorRegistry.register(UserSuspendedError);
```

`reconstruct()` then rebuilds it from a serialised payload — this is what `@lindorm/conduit` does with a failed HTTP response:

```typescript
const error = errorRegistry.reconstruct({
  message: "Account suspended",
  name: "UserSuspendedError",
  status: 403,
  code: "USER_SUSPENDED",
});

error instanceof UserSuspendedError; // true
```

Both ends must register the class. Registration is an **import side effect**, so the class has to live somewhere both the thrower and the catcher import — a shared package. If the reconstructing process has never imported it, resolution falls back to the status and you get a plain `ForbiddenError`. That is the intended degradation, but it means a missing import turns `instanceof` silently false rather than throwing.

### Resolution order

`resolve()` picks the class in this order:

1. **By name** — a registered class with that exact name.
2. **By exact status** — the canonical class for that status (`404` → `NotFoundError`).
3. **By status range** — `ClientError` for any other 4xx, `ServerError` for any other 5xx.
4. **`LindormError`** — nothing matched.

### Names and statuses are not symmetrical

Registering a subclass adds it to the name map. It does **not** change what a bare status resolves to: the status map keeps its **first** registration, which is always the canonical HTTP class, since defining a subclass requires importing this package and that registers the built-ins first.

This matters more than it looks, because **JavaScript inherits statics**. `UserSuspendedError extends ForbiddenError` inherits `static status = 403` without declaring it. Were the status map last-write-wins, registering it would quietly make _every_ bare 403 — including one from a third-party API that has never heard of your application — reconstruct as `UserSuspendedError`. It does not:

```typescript
errorRegistry.register(UserSuspendedError);

errorRegistry.resolve({ name: "UserSuspendedError" }); // UserSuspendedError
errorRegistry.resolve({ status: 403 }); // ForbiddenError — unchanged
```

### API

| Method                 | Returns             | Description                                                               |
| ---------------------- | ------------------- | ------------------------------------------------------------------------- |
| `register(cls)`        | `void`              | Adds by name, and by status if it is the first class to claim that status |
| `resolve(hint)`        | `LindormErrorClass` | Resolves a class from `{ name?, status? }` using the order above          |
| `reconstruct(payload)` | `LindormError`      | Resolves the class and constructs it with the payload's fields            |
| `has(name)`            | `boolean`           | Whether a class is registered under that name                             |
| `unregister(name)`     | `boolean`           | Removes it; releases the status only if this class actually held it       |

`register()` throws if the class is anonymous — a class with no name cannot be resolved by one.

## Exported Symbols

| Symbol                                                        | Kind     |
| ------------------------------------------------------------- | -------- |
| `LindormError`                                                | class    |
| `LindormErrorOptions`                                         | type     |
| `LindormErrorAttributes`                                      | type     |
| `ClientError`                                                 | class    |
| `ServerError`                                                 | class    |
| `AbortError`                                                  | class    |
| `AbortErrorOptions`                                           | type     |
| `NetworkError`                                                | class    |
| `NotFoundError`, `UnauthorizedError`, … (one per HTTP status) | class    |
| `HttpErrorOptions`                                            | type     |
| `ErrorRegistry`                                               | class    |
| `errorRegistry`                                               | instance |
| `LindormErrorClass`, `ResolveHint`, `ReconstructPayload`      | type     |
| `createErrorTypeUrn`, `assertValidErrorType`                  | function |
| `generateSupport`                                             | function |

## License

AGPL-3.0-or-later
