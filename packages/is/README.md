# @lindorm/is

Type-guard helpers for primitives, objects, URLs, and JOSE tokens.

## Installation

```bash
npm install @lindorm/is
```

This package is ESM-only. Import it with `import` syntax from a project that supports ECMAScript modules. `isBuffer` and `isEqual` rely on the Node.js `Buffer` global, so the package targets Node.js runtimes.

## Features

- Type-predicate helpers for primitives, errors, dates, promises, classes, functions, and URLs that narrow the input inside `if` blocks.
- String-format checks for ISO 8601 date strings, integer strings, and the literal boolean strings `"true"` / `"false"`.
- `isEqual` deep equality with dedicated handling for `NaN`, `Date`, `Error`, `Buffer`, `URL`, `Set`, `Map`, arrays, plain objects, and circular references.
- `isEmpty` covering `null`, `undefined`, empty strings, empty arrays, and plain objects with no own keys.
- JOSE token shape checks (`isJwt`, `isJws`, `isJwe`, `isWebToken`) that validate segment count, base64url structure, and the decoded header's `alg` / `typ` fields.
- Every helper is a named export from a single entry point, so unused checks tree-shake out.

## Usage

```typescript
import { isArray, isEmpty, isEqual, isJwt, isUrlLike } from "@lindorm/is";

const handle = (input: unknown, cached: unknown) => {
  if (isEmpty(input)) return undefined;

  if (isArray<string>(input)) {
    return input.filter((entry) => !isEmpty(entry));
  }

  if (typeof input === "string" && isJwt(input)) {
    return input;
  }

  if (isUrlLike(input)) {
    return new URL(input as string | URL);
  }

  if (isEqual(input, cached)) {
    return cached;
  }

  return input;
};
```

## API

Every helper is exported individually from `@lindorm/is`. Helpers whose return type is `input is T` narrow the input when used in a conditional; helpers whose return type is `boolean` only report the result.

### Primitives

| Helper            | Signature                                       | Notes                                                                                                                                     |
| ----------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `isArray`         | `<T>(input: any) => input is Array<T>`          | True for arrays. The implementation also requires a truthy input, so it is equivalent to `Array.isArray` for any value an array can hold. |
| `isBigInt`        | `(input?: any) => input is bigint`              | `typeof input === "bigint"`.                                                                                                              |
| `isBoolean`       | `(input?: any) => input is boolean`             | `typeof input === "boolean"`.                                                                                                             |
| `isTrue`          | `(input?: any) => input is true`                | Strict `=== true`.                                                                                                                        |
| `isFalse`         | `(input?: any) => input is false`               | Strict `=== false`.                                                                                                                       |
| `isBooleanString` | `(input?: any) => input is string`              | True only for the exact strings `"true"` or `"false"`.                                                                                    |
| `isBuffer`        | `(input?: any) => input is Buffer`              | Wraps `Buffer.isBuffer`. Node.js only.                                                                                                    |
| `isDate`          | `(input: any) => input is Date`                 | True for `Date` instances whose `getTime()` is not `NaN`.                                                                                 |
| `isDateString`    | `(input: any) => input is string`               | Matches ISO 8601 with a `T` separator and either `Z` or a `±HH:MM` offset; fractional seconds are optional.                               |
| `isFinite`        | `<T extends number>(input?: any) => input is T` | A number that is neither `NaN` nor `±Infinity`.                                                                                           |
| `isNaN`           | `(input?: any) => input is number`              | True only when the value is the number `NaN`.                                                                                             |
| `isNull`          | `(input?: any) => input is null`                | Strict `=== null`.                                                                                                                        |
| `isNumber`        | `<T extends number>(input?: any) => input is T` | `typeof input === "number"`. Includes `NaN` and `±Infinity`.                                                                              |
| `isNumberString`  | `(input?: any) => input is string`              | Matches `^-?\d+$`. Integers only — no decimals, exponents, or whitespace.                                                                 |
| `isString`        | `<T = string>(input?: any) => input is T`       | `typeof input === "string"`.                                                                                                              |
| `isUndefined`     | `(input?: any) => input is undefined`           | Strict `=== undefined`.                                                                                                                   |

### Objects, classes, errors, promises

| Helper         | Signature                                           | Notes                                                                                                                                                                                                                                                            |
| -------------- | --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isClass`      | `(input: any) => boolean`                           | Heuristic: returns `true` when `constructor.toString()` (on the value or on its `prototype`, if present) starts with `"class"`. Matches both class constructors and instances of native classes such as `URL`.                                                   |
| `isError`      | `(input: any) => input is Error`                    | True for `Error` instances and for any object exposing string `name` and `message` properties.                                                                                                                                                                   |
| `isFunction`   | `(input?: any) => input is (...args: any[]) => any` | `typeof input === "function"`.                                                                                                                                                                                                                                   |
| `isObject`     | `<T extends Dict = Dict>(input: any) => input is T` | True for object-like values; explicitly excludes `null`, arrays, `Buffer`, classes (and instances of native classes such as `URL`), `Date`, `Error`, and `Promise`.                                                                                              |
| `isObjectLike` | `(input: any) => input is Record<string, any>`      | True for any non-null `typeof === "object"` value that is not an array. Includes `Buffer`, `Date`, `Error`, `URL`, `Set`, `Map`, and class instances.                                                                                                            |
| `isPromise`    | `(input?: any) => input is Promise<any>`            | True when `then`, `catch`, and `finally` are all functions on the input.                                                                                                                                                                                         |
| `isEmpty`      | `(input: any) => boolean`                           | True for `null`, `undefined`, an empty string, an empty array, or a plain object with no own keys. All other values return `false`.                                                                                                                              |
| `isEqual`      | `(expect: any, actual: any) => boolean`             | Deep equality with explicit handling for `NaN`, `Date` (compared by `getTime()`), `Error` (compared by `name` and `message`), `Buffer` (`.equals`), `URL` (`.toString()`), `Set`, `Map`, arrays, and plain objects. Tracks visited references to support cycles. |

### URLs

| Helper      | Signature                                            | Notes                                                                                          |
| ----------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `isUrl`     | `(input: any) => input is URL`                       | True only for `URL` instances.                                                                 |
| `isUrlLike` | `(input: any, base?: any) => input is URL \| string` | True for `URL` instances or any value that successfully parses through `new URL(input, base)`. |

### JOSE tokens

All four helpers reject non-string input, validate the dot-separated structure with a regex, decode the first segment as the header, and return `true` only when the header parses and the relevant `alg` / `typ` fields are set as listed below. They do not verify signatures, decryption, or claims.

| Helper       | Signature                         | Header check                                                                         |
| ------------ | --------------------------------- | ------------------------------------------------------------------------------------ |
| `isJwt`      | `(input: any) => boolean`         | 3 segments, `typeof header.alg === "string"`, `header.typ === "JWT"`.                |
| `isJws`      | `(input: any) => boolean`         | 3 segments, `typeof header.alg === "string"`, `header.typ === "JWS"`.                |
| `isJwe`      | `(input: any) => boolean`         | 5 segments, `typeof header.alg === "string"`, `header.typ === "JWE"`.                |
| `isWebToken` | `(input: any) => input is string` | 3 or 5 segments, `typeof header.alg === "string"`, `typeof header.typ === "string"`. |

## License

AGPL-3.0-or-later
