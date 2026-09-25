# @lindorm/cbor

Table-driven CBOR codec. Declare a record's fields once — domain key, wire label, value kind — and
`CborKit` maps plain objects to compact CBOR maps and back.

## Installation

```bash
npm install @lindorm/cbor
```

This package is ESM-only; `require` is not supported. Byte fields decode to a Node `Buffer`, so it
targets Node.js rather than the browser.

## Usage

```ts
import { CborKit } from "@lindorm/cbor";

type Token = { sub: string; iat: Date; amr: string; sig: string };

const kit = new CborKit<Token>({
  version: { label: 0, value: 1 },
  fields: [
    { key: "sub", label: 1, kind: "text" },
    { key: "iat", label: 2, kind: "date" },
    { key: "amr", label: 3, kind: "enum", enum: { pwd: 1, otp: 2 } },
    { key: "sig", label: 4, kind: "bstr", encoding: "b64u" },
  ],
});

const bytes = kit.encode({
  sub: "user-123",
  iat: new Date("2026-07-16T00:00:00.000Z"),
  amr: "otp",
  sig: "AQIDBA",
});
// 27 bytes: a500010168757365722d313233021a6a581f000302044401020304

kit.decode(bytes);
// { sub: "user-123", iat: 2026-07-16T00:00:00.000Z, amr: "otp", sig: "AQIDBA" }
```

Encoding is deterministic — the same record always produces the same bytes, so they can be signed
over directly. Fields that are absent, `null`, or empty text are not written. `version` is written on
encode and verified on decode.

The table is validated when the kit is constructed: a duplicate label, label `0` on a field, an
`enum` kind without its map, a `bespoke` kind without its `encode`/`decode`. Every failure in this
package throws a `CborError` carrying a `code`.

### Strict and lax decode

`mode` decides what decode does with a wire label the table does not recognise.

- `"strict"` (default) — the format is closed, so an unrecognised label is corruption: throws
  `CborError` with code `unknown_label`.
- `"lax"` — the value is kept verbatim under its wire key, so a record written by a newer table
  round-trips through an older one without loss.

```ts
import { CborKit } from "@lindorm/cbor";

const fields = [{ key: "sub", label: 1, kind: "text" }] as const;

const strict = new CborKit({ fields });
const lax = new CborKit({ mode: "lax", fields });

const newer = new CborKit({
  fields: [...fields, { key: "acr", label: 2, kind: "text" }],
});
const bytes = newer.encode({ sub: "user-1", acr: "urn:acr:1" });

lax.decode(bytes); // { "2": "urn:acr:1", sub: "user-1" }
strict.decode(bytes); // throws CborError — code "unknown_label"
```

### Map mode

`"map"` as the first argument stops one step short of the bytes: `encode("map", value)` returns the
wire map, and `decode("map", map)` takes one. A consumer with its own CBOR serializer — a COSE layer,
say — keeps byte-level policy on its own side that way. Serializing the map yields the same bytes
`encode(value)` does.

```ts
import { CborKit } from "@lindorm/cbor";

const kit = new CborKit({
  fields: [
    { key: "sub", label: 1, kind: "text" },
    { key: "scope", label: 2, kind: "array" },
  ],
});

const map = kit.encode("map", { sub: "user-1", scope: ["read", "write"] });
// Map(2) { 1 => "user-1", 2 => [ "read", "write" ] }

kit.decode("map", map); // { sub: "user-1", scope: [ "read", "write" ] }
```

### Proprietary labels

A `proprietary` field is one whose compact integer label only means something on your own platform.
It is written under that label by default; under `{ proprietary: false }` it is written under its
string `key` instead — the interoperable form. Decode accepts either, and applies the field's value
transform both ways.

```ts
import { CborKit } from "@lindorm/cbor";

const kit = new CborKit({
  fields: [
    { key: "iss", label: 1, kind: "text" },
    { key: "client_id", label: -65548, kind: "text", proprietary: true },
  ],
});

const record = { iss: "https://idp.example", client_id: "client-1" };

kit.encode("map", record);
// Map(2) { 1 => "https://idp.example", -65548 => "client-1" }

kit.encode("map", record, { proprietary: false });
// Map(2) { 1 => "https://idp.example", "client_id" => "client-1" }

kit.decode(kit.encode(record, { proprietary: false })); // equals record
```

A proprietary field needs an integer label. String labels require `labels: "mixed"`.

## API

### `class CborKit<T>` — `ICborKit<T>`

| Member                                                           | Description                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------- |
| `new CborKit<T>(spec: CborSpec)`                                 | Validates the table; throws `CborError` on a bad one. |
| `encode(value, options?): Uint8Array`                            | Record → CBOR bytes.                                  |
| `encode("map", value, options?): Map<number \| string, unknown>` | Record → wire map.                                    |
| `decode(bytes: Uint8Array): T`                                   | CBOR bytes → record.                                  |
| `decode("map", map: Map<number \| string, unknown>): T`          | Wire map → record.                                    |

`options` is `CborEncodeOptions` — `{ proprietary?: boolean }`, default `true`.

### `type CborSpec`

Also exported as `CborKitSettings`.

| Key       | Type                               | Default    | Description                                                                  |
| --------- | ---------------------------------- | ---------- | ---------------------------------------------------------------------------- |
| `fields`  | `ReadonlyArray<CborField>`         | required   | The field table.                                                             |
| `version` | `{ label: number; value: number }` | none       | Written on encode, verified on decode; a mismatch throws `version_mismatch`. |
| `mode`    | `"strict" \| "lax"`                | `"strict"` | Decode's handling of an unrecognised wire label.                             |
| `labels`  | `"int" \| "mixed"`                 | `"int"`    | Whether fields may carry string labels as well as integer ones.              |

### `type CborField`

| Key               | Description                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------- |
| `key`             | Domain key on the plain-object record.                                                        |
| `label`           | Wire key: a nonzero integer (`0` is the version tag), or a string when `labels` is `"mixed"`. |
| `kind`            | One of `CborValueKind`.                                                                       |
| `proprietary`     | Degrades from the integer `label` to the string `key` under `{ proprietary: false }`.         |
| `enum`            | Required for kind `"enum"`: domain value → integer wire code.                                 |
| `encoding`        | `"b64u"` or `"base64"`, for `"bstr"` / `"bstrArray"`: the domain value is a base64 string.    |
| `encode`/`decode` | Required for kind `"bespoke"`: domain value ⇄ wire value.                                     |

### `type CborValueKind`

| Kind        | Domain value                                     | Wire value            |
| ----------- | ------------------------------------------------ | --------------------- |
| `text`      | `string`                                         | text string           |
| `int`       | `number`                                         | integer               |
| `bool`      | `boolean`                                        | boolean               |
| `date`      | `Date`                                           | unix seconds          |
| `enum`      | a key of the field's `enum` map                  | its integer code      |
| `array`     | array of primitives                              | array                 |
| `bstr`      | `Uint8Array`, or a base64 string with `encoding` | byte string           |
| `bstrArray` | array of the above                               | array of byte strings |
| `bespoke`   | whatever the field's `encode`/`decode` handle    | whatever they return  |

### `class CborError`

Every failure. `code` is one of `duplicate_label`, `invalid_bespoke_config`,
`invalid_encoding_config`, `invalid_enum_config`, `invalid_label`, `unknown_enum_int`,
`unknown_enum_value`, `unknown_label`, `unknown_value_kind`, `version_mismatch`.

## License

AGPL-3.0-or-later
