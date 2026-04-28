# @lindorm/json-kit

Loss-less JSON serialisation for JavaScript values that don't survive `JSON.stringify` — `Date`, `Buffer`, `BigInt`, `undefined`, and the `null` vs `undefined` distinction.

The library wraps data in a metadata envelope (`__meta__` plus `__record__` for objects or `__array__` for arrays) so it can be round-tripped back to its original types after transport or storage.

## Installation

```bash
npm install @lindorm/json-kit
```

This package is ESM-only. All examples use `import` syntax; `require` is not supported.

## Features

- Serialise and parse objects and arrays with full type fidelity for `Date`, `Buffer`, `BigInt`, `string`, `number`, `boolean`, `null`, and `undefined`.
- Recursive handling of nested objects and arrays.
- Output as either a string or a Node `Buffer`.
- Round-trip from a string, a `Buffer`, or a previously-built envelope object.
- Standalone `deserialise` helper for coercing string-typed values (e.g. Redis hash fields, database columns) into their declared JavaScript types.

## Quick start

```ts
import { JsonKit } from "@lindorm/json-kit";

const original = {
  now: new Date(),
  payload: Buffer.from("secret"),
  counter: 123,
  big: BigInt("9007199254740993"),
  maybe: undefined,
};

const str = JsonKit.stringify(original);

const restored = JsonKit.parse<typeof original>(str);

restored.now instanceof Date; // true
Buffer.isBuffer(restored.payload); // true
typeof restored.big === "bigint"; // true
restored.maybe === undefined; // true
```

The output of `JsonKit.stringify` is plain JSON with two top-level keys: `__meta__` (a parallel structure of one-character type tags) and `__record__` (for objects) or `__array__` (for arrays) holding the stringified payload. `JsonKit.parse` consumes that shape and reconstructs the original values.

## API

### `JsonKit`

Static class. Each method delegates to a `Primitive` instance.

| Method              | Signature                         | Description                                                                |
| ------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| `JsonKit.stringify` | `<T>(input: T) => string`         | Serialise an object or array to a JSON string with type metadata.          |
| `JsonKit.parse`     | `<T>(input: any) => T`            | Restore from a JSON string, a `Buffer`, or an envelope object.             |
| `JsonKit.buffer`    | `<T>(input: T) => Buffer`         | Serialise as `JsonKit.stringify` and return the result as a Node `Buffer`. |
| `JsonKit.primitive` | `<T>(input: any) => Primitive<T>` | Build the underlying `Primitive` wrapper without serialising further.      |

`T` defaults to `Dict` (a plain object) but is constrained to `Array<any> | Dict`.

### `Primitive<T>`

Lower-level wrapper. `JsonKit` is a thin facade over this class; reach for `Primitive` directly when you need access to the intermediate `data` and `meta` representations.

```ts
import { Primitive } from "@lindorm/json-kit";

const p = new Primitive({ name: "Alice", createdAt: new Date() });

p.data; // stringified record
p.meta; // parallel type-tag structure

p.toString(); // JSON string with envelope
p.toBuffer(); // Buffer.from(p.toString())
p.toJSON(); // restored object with original types
```

The constructor accepts any of the following inputs:

- A plain object — wrapped, with all leaf values stringified and a parallel meta structure built.
- An array — same as object, but produces an `__array__` envelope.
- A JSON string previously produced by `Primitive` / `JsonKit` — parsed back into stored `data` and `meta`.
- A `Buffer` whose contents are such a JSON string — parsed identically.
- An envelope object of shape `{ __meta__, __record__ }` or `{ __meta__, __array__ }` — adopted directly.

Anything else throws `TypeError("Expected input to be an array or object")`.

| Member                    | Returns              | Description                                                        |
| ------------------------- | -------------------- | ------------------------------------------------------------------ |
| `new Primitive<T>(input)` | `Primitive<T>`       | See input forms above.                                             |
| `primitive.data`          | `T`                  | The stringified payload (object or array of leaf strings/numbers). |
| `primitive.meta`          | `Array<any> \| Dict` | The parallel meta structure of type tags.                          |
| `primitive.toString()`    | `string`             | JSON string of `{ __meta__, __record__ \| __array__ }`.            |
| `primitive.toBuffer()`    | `Buffer`             | `Buffer.from(this.toString())`.                                    |
| `primitive.toJSON()`      | `T`                  | Restored value with original types.                                |

### `deserialise(value, type)`

Standalone type-coercion helper used at boundaries where values arrive as strings (Redis hash fields, database column values, query string parameters, etc.).

```ts
import { deserialise } from "@lindorm/json-kit";

deserialise("42", "integer"); // 42
deserialise("3.14", "float"); // 3.14
deserialise("true", "boolean"); // true
deserialise("9007199254740993", "bigint"); // 9007199254740993n
deserialise("2024-01-01T00:00:00.000Z", "date"); // Date
```

Signature: `(value: any, type: string | null) => any`.

| `type`                           | Behaviour                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `"bigint"`                       | Returns `BigInt(value)`. `null` / `undefined` becomes `BigInt(0)`. Throws if the value cannot be converted.                                                                            |
| `"boolean"`                      | Returns booleans as-is. Strings: only `"true"` is `true`, everything else is `false`. Other values fall through `Boolean(value)`.                                                      |
| `"date"`                         | Returns valid `Date` instances as-is. Throws on invalid `Date`. `null` / `undefined` is returned as-is. Strings/numbers are converted via `new Date(value)` and validated.             |
| `"float"`                        | Returns numbers as-is. `null` / `undefined` becomes `0`. Strings are parsed via `parseFloat`. Throws on non-numeric strings.                                                           |
| `"integer"`                      | Returns integers as-is, truncates non-integer numbers via `Math.trunc`. `null` / `undefined` becomes `0`. Strings are parsed via `parseInt(value, 10)`. Throws on non-numeric strings. |
| `"array"` / `"object"`           | Non-string values are returned as-is. Strings are parsed via `Primitive` first (recovering rich types), falling back to `JSON.parse` if that fails.                                    |
| anything else (including `null`) | Returned unchanged — covers `"string"`, `"uuid"`, and any custom passthrough type.                                                                                                     |

Because the `"array"` / `"object"` branch tries `Primitive` first and falls back to `JSON.parse`, plain `JSON.stringify`'d input also round-trips for primitive-only payloads, but `Date` and `Buffer` cannot be recovered from input that was not produced by `JsonKit` / `Primitive`.

## Behaviour notes

- `Buffer` content is encoded as `base64url` in the serialised payload.
- `BigInt` is serialised as its decimal string to avoid IEEE-754 precision loss.
- `Date` is serialised as ISO-8601 (`toISOString()`).
- `null` and `undefined` are stored as `0` in the payload and disambiguated through the meta tag, so both round-trip correctly.
- Functions and class instances fall through to `JSON.stringify` and are tagged as unknown; they will not round-trip to their original form.
- Circular references are not supported.

## License

AGPL-3.0-or-later
