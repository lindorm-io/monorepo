# @lindorm/json-kit

Loss-less serialisation helpers for JavaScript values that don’t normally  
survive `JSON.stringify` – such as **Date**, **Buffer**, `undefined`, etc.  
`@lindorm/json-kit` wraps your data in a tiny metadata envelope so it can be  
round-tripped _back to its original types_ after transport or storage.

The library is framework-agnostic, depends only on `@lindorm/is` and embraces  
plain objects.  It is a perfect companion when you need to squeeze complex  
state into a database column, message bus or cache.

---

## Installation

```bash
npm install @lindorm/json-kit
# or
yarn add @lindorm/json-kit
```

---

## Quick glance

```ts
import { JsonKit } from '@lindorm/json-kit';

const original = {
  now: new Date(),
  payload: Buffer.from('secret'),
  counter: 123,
  maybe: undefined,
};

// 1. Stringify (meta is embedded automatically)
const str = JsonKit.stringify(original);

// 2. Persist / send over the wire …

// 3. Parse – voilà, the Date and Buffer are restored
const clone = JsonKit.parse<typeof original>(str);

clone.now       instanceof Date;   // true
Buffer.isBuffer(clone.payload);     // true
clone.maybe === undefined;          // true
```

The generated JSON looks like this (shortened for readability):

```jsonc
{
  "__meta__": {           // type map
    "now": "D",          // D = Date
    "payload": "F",      // F = Buffer (File)
    "maybe": "U"          // U = Undefined
  },
  "__record__": {
    "now": "2024-06-25T12:00:00.000Z",
    "payload": "c2VjcmV0",     // base64-encoded Buffer
    "counter": 123
  }
}
```

---

## API

### `JsonKit.stringify(data)` → `string`
Turns an object or array into a JSON‐compatible string while preserving  
non-standard primitives.

### `JsonKit.parse(str | Buffer)` → `T`
Reverses `stringify`.  Accepts either string or `Buffer`.

### `JsonKit.buffer(data)` → `Buffer`
Same as `stringify` but returns a Node `Buffer` instead of string.

### `JsonKit.primitive(data)` → `Primitive<T>`
Returns the low-level `Primitive` wrapper that exposes the raw metadata and  
helper methods (`toJSON()`, `toString()`, `toBuffer()`).  Useful if you want to  
manipulate the envelope yourself.

---

## What is stored in `__meta__`?

Each value is tagged with a single-character **MetaType** code:

| Code | Type       |
|------|------------|
| `A`  | Array      |
| `B`  | Boolean    |
| `D`  | Date       |
| `F`  | Buffer     |
| `L`  | Null       |
| `N`  | Number     |
| `S`  | String     |
| `U`  | Undefined  |
| `X`  | Unknown    |

During `parse` Json-Kit walks the structure and casts every value back to its  
original representation.

---

## Caveats

• Functions and class instances are **not** serialised – they fall back to  
`MetaType.Unknown` and are returned untouched.  
• Circular references are **not** supported.  
• For security reasons the `Buffer` content is base64-encoded, not hex.

---

## Contributing

1. `cd packages/json-kit && npm ci`  
2. Make your changes & add tests (`npm test`)  
3. Send a pull request – maintain 100 % test coverage ☂️

---

## License

AGPL-3.0-or-later – © Lindorm, 2024
