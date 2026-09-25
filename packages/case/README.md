# @lindorm/case

String case conversion utilities for strings, object keys, and string arrays.

## Installation

```bash
npm install @lindorm/case
```

This package is **ESM-only**. Import it with `import` syntax from a project that supports ECMAScript modules.

## Features

- Convert strings between 11 case conventions: camel, capital, constant, dot, header, kebab, lower, pascal, path, sentence, snake.
- Convert the keys of an object (or an array of objects) recursively, preserving values — with an optional `depth` limit and an optional `exempt` predicate for keys to keep verbatim.
- Convert an array of strings element-by-element; non-string entries pass through untouched.
- Generic `changeCase` and `changeKeys` dispatchers that pick a conversion at runtime via a string mode.

## Supported case modes

| Mode       | Example output  |
| ---------- | --------------- |
| `camel`    | `camelCase`     |
| `capital`  | `Capital Case`  |
| `constant` | `CONSTANT_CASE` |
| `dot`      | `dot.case`      |
| `header`   | `Header-Case`   |
| `kebab`    | `kebab-case`    |
| `lower`    | `lower case`    |
| `pascal`   | `PascalCase`    |
| `path`     | `path/case`     |
| `sentence` | `Sentence case` |
| `snake`    | `snake_case`    |
| `none`     | input unchanged |

The `none` mode is only accepted by `changeCase` and `changeKeys`; it is not exposed as a dedicated function.

## Usage

### Convert a string

```typescript
import { camelCase, pascalCase, snakeCase } from "@lindorm/case";

const a = camelCase("Hello world"); // "helloWorld"
const b = pascalCase("hello-world"); // "HelloWorld"
const c = snakeCase("HelloWorld"); // "hello_world"
```

### Convert object keys

`xxxKeys` walks the input recursively. Object keys are transformed; nested objects and arrays of objects are walked; non-object/non-array values are kept as-is.

```typescript
import { camelKeys } from "@lindorm/case";

const input = {
  user_id: "123",
  first_name: "Alice",
  contact_info: {
    phone_number: "555-0100",
  },
};

const output = camelKeys(input);
// {
//   userId: "123",
//   firstName: "Alice",
//   contactInfo: { phoneNumber: "555-0100" },
// }
```

The same function accepts an array of objects:

```typescript
import { snakeKeys } from "@lindorm/case";

const rows = snakeKeys([{ firstName: "Alice" }, { firstName: "Bob" }]);
// [{ first_name: "Alice" }, { first_name: "Bob" }]
```

### Limit the depth

By default the walk is unlimited. Pass `depth` to stop after a number of key levels — useful when a payload carries a field whose inner keys are defined by someone else's schema and must reach the wire verbatim (RFC 9396 `authorization_details`, for example).

```typescript
import { snakeKeys } from "@lindorm/case";

const body = snakeKeys(
  {
    grantType: "authorization_code",
    authorizationDetails: [
      { type: "payment_initiation", instructedAmount: { currencyCode: "EUR" } },
    ],
  },
  { depth: 1 },
);
// {
//   grant_type: "authorization_code",
//   authorization_details: [
//     { type: "payment_initiation", instructedAmount: { currencyCode: "EUR" } },
//   ],
// }
```

Semantics:

- Depth counts **object-key levels**. Level 1 is the input object's own keys.
- **Arrays are transparent containers** — they have no keys of their own, so entering one does not consume a level. `snakeKeys([{ firstName: "Alice" }], { depth: 1 })` converts `firstName`.
- Descending into an object **value** consumes a level.
- A subtree beyond the depth is kept verbatim, by reference — it is neither converted nor cloned.
- Omitting `depth` (or passing `Infinity`) means unlimited.
- `depth` must be an integer `>= 1`; `0`, negatives and fractions throw. "Convert nothing" is spelled `changeKeys(input, "none")`.

`changeKeys` takes the same options as a third argument: `changeKeys(input, "snake", { depth: 1 })`. With mode `"none"` the input is returned as-is and the options are not inspected.

### Exempt keys

Pass `exempt` to keep a key and its value verbatim, by reference — the same as a subtree beyond `depth`. The predicate is checked before descent, at every level and inside arrays, and an exempt key spends no depth. `isVerbatimKey` is the shipped predicate: `true` for a key holding a character that is neither a letter, a digit nor `_` (`x5t#S256`, `https://claims.lindorm.io/tenant`, `X-Request-Id`). `_` stays caseable, so `snake_case` still converts.

```typescript
import { isVerbatimKey, snakeKeys } from "@lindorm/case";

const body = snakeKeys(
  {
    tokenClaims: {
      "https://claims.lindorm.io/tenant": { tenantId: "acme" },
      issuedAt: 1,
    },
  },
  { exempt: isVerbatimKey },
);
// {
//   token_claims: {
//     "https://claims.lindorm.io/tenant": { tenantId: "acme" },
//     issued_at: 1,
//   },
// }
```

### Convert an array of strings

`xxxArray` transforms string entries; any non-string entry is appended to the result unchanged.

```typescript
import { kebabArray } from "@lindorm/case";

const result = kebabArray(["firstName", "lastName"]);
// ["first-name", "last-name"]
```

### Pick a case at runtime

```typescript
import { changeCase, changeKeys, type ChangeCase } from "@lindorm/case";

const mode: ChangeCase = "pascal";

const str = changeCase("hello-world", mode); // "HelloWorld"
const obj = changeKeys({ "first-name": "Alice" }, mode); // { FirstName: "Alice" }
```

`ChangeCase` is a string union (`"camel" | "capital" | "constant" | "dot" | "header" | "kebab" | "lower" | "pascal" | "path" | "sentence" | "snake" | "none"`), not an enum. Pass the literal string. If `mode` is omitted it defaults to `"none"`, which returns the input unchanged.

## API

### Per-case functions

For each mode in `camel`, `capital`, `constant`, `dot`, `header`, `kebab`, `lower`, `pascal`, `path`, `sentence`, `snake`, the package exports three functions:

| Function      | Signature                                                     | Description                                                      |
| ------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<mode>Case`  | `(input: string) => string`                                   | Convert a single string. Throws if `input` is not a string.      |
| `<mode>Keys`  | `<T extends KeysInput>(input: T, options?: KeysOptions) => T` | Recursively convert keys of an object or array of objects.       |
| `<mode>Array` | `(input: Array<string>) => Array<string>`                     | Convert each string entry; non-string entries are kept in place. |

So for example: `camelCase`, `camelKeys`, `camelArray`; `snakeCase`, `snakeKeys`, `snakeArray`; and so on for all 11 modes.

### Generic dispatchers

| Function     | Signature                                                                        | Description                                                                                                         |
| ------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `changeCase` | `(input: string, mode?: ChangeCase) => string`                                   | Apply the named case to a string. Defaults to `"none"`. Throws on an unknown mode.                                  |
| `changeKeys` | `<T extends KeysInput>(input: T, mode?: ChangeCase, options?: KeysOptions) => T` | Apply the named case to the keys of an object or array of objects. Defaults to `"none"`. Throws on an unknown mode. |

### Predicates

| Function        | Signature                  | Description                                                                                          |
| --------------- | -------------------------- | ---------------------------------------------------------------------------------------------------- |
| `isVerbatimKey` | `(key: string) => boolean` | `true` for a key holding a character that is neither a letter, a digit nor `_`. Pass it as `exempt`. |

### Constants

| Constant            | Type             | Description                                            |
| ------------------- | ---------------- | ------------------------------------------------------ |
| `CHANGE_CASE_MODES` | `readonly tuple` | Every supported mode. `ChangeCase` is derived from it. |

### Types

| Type           | Definition                                                    | Description                                           |
| -------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| `ChangeCase`   | `(typeof CHANGE_CASE_MODES)[number]`                          | Mode accepted by `changeCase` and `changeKeys`.       |
| `CaseCallback` | `(input: string) => string`                                   | Signature shared by all per-mode `xxxCase` functions. |
| `KeysInput`    | `Dict \| Array<Dict>` (where `Dict` is `Record<string, any>`) | Input shape accepted by `xxxKeys` and `changeKeys`.   |
| `KeysOptions`  | `{ depth?: number; exempt?: (key: string) => boolean }`       | Per-call options for `xxxKeys` and `changeKeys`.      |

## Error handling

- `xxxCase(input)` throws if `input` is not a string (e.g. `null`, `undefined`, a number).
- `xxxKeys(input)` and `changeKeys(input, mode)` throw if `input` is neither an object nor an array.
- `xxxKeys(input, { depth })` and `changeKeys(input, mode, { depth })` throw `Error("Invalid depth [ ... ]")` if `depth` is not an integer `>= 1` (or `Infinity`).
- `xxxArray(input)` throws if `input` is not an array. Non-string entries inside the array are passed through, not converted.
- `changeCase` and `changeKeys` throw `Error("Invalid transform case [ ... ]")` if `mode` is not one of the supported values.

## License

AGPL-3.0-or-later
