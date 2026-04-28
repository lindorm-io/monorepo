# @lindorm/url

Small set of helpers for building, validating, and inspecting URLs on top of the platform `URL` class.

## Installation

```bash
npm install @lindorm/url
```

This package is **ESM-only**. Import it with `import` syntax from a project that supports ECMAScript modules.

## Features

- Build a `URL` from a path, a base, a host string, and a port, with sane precedence rules.
- Substitute `:name` path parameters with strings, numbers, booleans, or arrays.
- Append query parameters from a plain object, with optional key-case transformation (camel, snake, etc. via `@lindorm/case`).
- Merge query parameters that already exist on a URL with new ones supplied via options.
- Strip query and hash from a URL to get just origin + pathname.
- Coerce a `URL | string` input into a guaranteed `URL` instance, optionally relative to a base.
- Read a URL's search params back into a plain object, with light type coercion for digits and `"true"`/`"false"`.

## Usage

### Build a URL from a path, host, params, and query

```typescript
import { createUrl } from "@lindorm/url";

const url = createUrl("/users/:id", {
  host: "https://api.example.com",
  params: { id: "u1" },
  query: { include: "posts", page: 2 },
});

url.toString();
// "https://api.example.com/users/u1?include=posts&page=2"
```

### Build from an absolute URL string

```typescript
import { createUrl } from "@lindorm/url";

const url = createUrl("https://lindorm.io:5555/path?testCamel=one&hello_snake=two");
url.host; // "lindorm.io:5555"
url.pathname; // "/path"
url.search; // "?testCamel=one&hello_snake=two"
```

### Derive from an existing URL and merge query

When `createUrl` is called with a `URL` instance or a string starting with `http`, the existing search params are preserved and new query entries are appended.

```typescript
import { createUrl } from "@lindorm/url";

const url = createUrl(new URL("https://example.com/foo?bar=1"), {
  query: { baz: 2 },
});

url.toString();
// "https://example.com/foo?bar=1&baz=2"
```

### Transform query key casing

Pass `changeQueryCase` to convert each query key as it is appended. Accepted modes are the `ChangeCase` union from `@lindorm/case`.

```typescript
import { createUrl } from "@lindorm/url";

const url = createUrl("https://lindorm.io/url/path", {
  query: { queryOne: "string", queryTwo: 123, queryThree: true },
  changeQueryCase: "snake",
});

url.toString();
// "https://lindorm.io/url/path?query_one=string&query_two=123&query_three=true"
```

### Path parameter substitution

`:name` segments in the path are replaced with the matching value in `params`. Arrays are joined with a single space before URL encoding. The number of placeholders must equal the number of provided params; mismatches throw.

```typescript
import { createUrl } from "@lindorm/url";

const url = createUrl("https://lindorm.io/one/:a/two/:b", {
  params: { a: "string", b: ["array", 987, false] },
});

url.toString();
// "https://lindorm.io/one/string/two/array%20987%20false"
```

### Construct just an origin

`createBaseUrl` resolves a `URL` from either a `host` or a `base`, with `host` preferred when both are given. A `port` is applied only if the chosen origin does not already specify one.

```typescript
import { createBaseUrl } from "@lindorm/url";

createBaseUrl({ host: "https://test.lindorm.io", port: 4000 }).toString();
// "https://test.lindorm.io:4000/"

createBaseUrl({ host: "https://test.lindorm.io:4000", port: 3000 }).toString();
// "https://test.lindorm.io:4000/"  (existing port wins)
```

### Strip query and hash

```typescript
import { getPlainUrl } from "@lindorm/url";

getPlainUrl(new URL("https://test.lindorm.io:4000/path?a=1#frag")).toString();
// "https://test.lindorm.io:4000/path"
```

### Coerce input into a URL

`getValidUrl` accepts a `URL` instance or a string. With a relative string, pass `baseURL` as the second argument; without one, the input must already be absolute or it throws.

```typescript
import { getValidUrl } from "@lindorm/url";

getValidUrl("https://test.lindorm.io:3000/test/path").toString();
// "https://test.lindorm.io:3000/test/path"

getValidUrl("/test/path", "https://test.lindorm.io:3000").toString();
// "https://test.lindorm.io:3000/test/path"
```

### Read search params back into an object

`extractSearchParams` walks `url.searchParams` and returns a plain object. Values containing digits are parsed with `parseInt`; the literal strings `"true"` and `"false"` are converted to booleans; everything else stays a string.

```typescript
import { extractSearchParams } from "@lindorm/url";

extractSearchParams(
  new URL("https://test.lindorm.io/path?queryCamel=one&test_snake=true&HelloPascal=123"),
);
// { queryCamel: "one", test_snake: true, HelloPascal: 123 }
```

## API

### `createUrl<P, Q>(pathOrUrl, options?)`

```typescript
const createUrl: <P extends Dict<Param> = Dict<Param>, Q = Dict<Query>>(
  pathOrUrl: URL | string,
  options?: CreateUrlOptions<P, Q>,
) => URL;
```

Builds a `URL`. If `pathOrUrl` is a `URL` instance or a string starting with `http`, it is used as the origin and existing search params are merged with `options.query`. Otherwise `pathOrUrl` is treated as a path and either `options.host` or `options.baseUrl` is required to resolve the origin; if neither is provided, throws `Invalid base [ ... ]`.

### `createBaseUrl({ base?, host?, port? })`

```typescript
const createBaseUrl: (options: {
  base?: URL | string;
  host?: URL | string;
  port?: number;
}) => URL;
```

Resolves an origin `URL`. `host` takes precedence over `base`. `port` is appended only if the chosen origin does not already include a port. Throws if neither `base` nor `host` is supplied, or if the resulting string is not a valid URL.

### `extractSearchParams<T>(url)`

```typescript
const extractSearchParams: <T = Dict>(url: URL) => T;
```

Returns the URL's search params as an object. Digit-containing values become numbers (via `parseInt`), `"true"`/`"false"` become booleans, everything else stays a string.

### `getPlainUrl(url)`

```typescript
const getPlainUrl: (url: URL | string) => URL;
```

Returns a new `URL` containing only origin + pathname. Drops query and hash.

### `getValidUrl(url, baseURL?)`

```typescript
const getValidUrl: (url: URL | string, baseURL?: URL | string) => URL;
```

Returns `url` if it is already a `URL` instance, otherwise constructs a new `URL` from the string. Throws on invalid input.

### `CreateUrlOptions<P, Q>`

```typescript
type CreateUrlOptions<P = Dict<Param>, Q = Dict<Query>> = {
  baseUrl?: string;
  changeQueryCase?: ChangeCase;
  host?: string;
  params?: P;
  port?: number;
  query?: Q;
};
```

`ChangeCase` is re-exported from `@lindorm/case`. `Param`, `Query`, and `Dict` come from `@lindorm/types`.

## License

AGPL-3.0-or-later
