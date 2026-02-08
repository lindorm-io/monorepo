# @lindorm/json-kit

Loss-less serialisation helpers for JavaScript values that don't survive `JSON.stringify` -- such as
**Date**, **Buffer**, **BigInt**, `undefined`, and `null` vs `undefined` distinctions.

The library wraps data in a compact metadata envelope (`__meta__` + `__record__`/`__array__`) so it
can be round-tripped back to its original types after transport or storage.

---

## Installation

```bash
npm install @lindorm/json-kit
```

---

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

// Persist, send over the wire, store in Redis ...

const restored = JsonKit.parse<typeof original>(str);

restored.now instanceof Date;          // true
Buffer.isBuffer(restored.payload);     // true
typeof restored.big === "bigint";      // true
restored.maybe === undefined;          // true
```

The generated JSON looks like this (shortened):

```jsonc
{
  "__meta__": {
    "now": "D",
    "payload": "F",
    "big": "I",
    "maybe": "U"
  },
  "__record__": {
    "now": "2024-06-25T12:00:00.000Z",
    "payload": "c2VjcmV0",
    "counter": 123,
    "big": "9007199254740993"
  }
}
```

Arrays use `__array__` instead of `__record__` and nested structures are handled recursively.

---

## API

### `JsonKit`

Static utility class wrapping `Primitive`.

| Method | Returns | Description |
|---|---|---|
| `JsonKit.stringify(data)` | `string` | Serialise an object or array to a JSON string with type metadata |
| `JsonKit.parse<T>(input)` | `T` | Restore from string, `Buffer`, or envelope object |
| `JsonKit.buffer(data)` | `Buffer` | Same as `stringify` but returns a Node `Buffer` |
| `JsonKit.primitive(data)` | `Primitive<T>` | Returns the low-level `Primitive` wrapper |

### `Primitive<T>`

Low-level wrapper that holds the raw data and metadata.

```ts
import { Primitive } from "@lindorm/json-kit";

const p = new Primitive({ name: "Alice", createdAt: new Date() });

p.data;        // stringified record (all values are strings/numbers)
p.meta;        // type map { name: "S", createdAt: "D" }

p.toString();  // JSON string with __meta__ envelope
p.toBuffer();  // same as Buffer.from(p.toString())
p.toJSON();    // restored original object with proper types
```

Constructor accepts:
- A plain **object** or **array** (creates envelope)
- A **string** (parses envelope JSON)
- A **Buffer** (parses envelope JSON)
- An **envelope object** with `__meta__` + `__record__`/`__array__` (restores directly)

### `deserialise(value, type)`

Standalone type coercion function. Converts a raw value to the proper JS type based on a type
string. Used internally by persistence packages (Redis hash deserialization, entity column parsing).

```ts
import { deserialise } from "@lindorm/json-kit";

deserialise("42", "integer");     // 42
deserialise("true", "boolean");   // true
deserialise("2024-01-01T00:00:00.000Z", "date");  // Date object
deserialise("9007199254740993", "bigint");         // BigInt
```

| Type | Conversion |
|---|---|
| `"integer"` | `parseInt(value, 10)`, truncates floats |
| `"float"` | `parseFloat(value)` |
| `"bigint"` | `BigInt(value)`, null defaults to `BigInt(0)` |
| `"boolean"` | `value === "true"` (not `Boolean(value)`) |
| `"date"` | `new Date(value)`, validates result |
| `"array"` / `"object"` | Tries `Primitive` first, falls back to `JSON.parse` |
| `"string"` / `"uuid"` / other | Passthrough |

---

## MetaType codes

Each value in `__meta__` is tagged with a single-character code:

| Code | Type |
|---|---|
| `A` | Array |
| `B` | Boolean |
| `D` | Date |
| `F` | Buffer |
| `I` | BigInt |
| `L` | Null |
| `N` | Number |
| `S` | String |
| `U` | Undefined |
| `X` | Unknown |

---

## Caveats

- Functions and class instances are **not** serialised -- they fall back to `MetaType.Unknown`
- Circular references are **not** supported
- `Buffer` content is encoded as base64url
- `BigInt` is serialised as a string to avoid precision loss
- `JSON.stringify`'d data without `__meta__` markers can still be parsed, but rich types (Date,
  Buffer, BigInt) will not be restored -- only `Primitive`-serialised strings preserve them

---

## License

AGPL-3.0-or-later
