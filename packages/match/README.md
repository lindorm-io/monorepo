## @lindorm/match

Declarative, Mongo-style matching for in-memory data. Describe what you want with a
`Condition<T>` object and test values against it with `matches`, or query arrays with the
`Matcher` helpers.

This package is the **condition language** the `@lindorm` ecosystem shares — `@lindorm/proteus`
compiles the same shapes to SQL and Mongo, and `@lindorm/aegis`, `@lindorm/amphora`,
`@lindorm/pylon` and `@lindorm/iris` use them to select keys. What this package does IS the
specification; a driver that disagrees is wrong.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/match
```

## Conditions

A `Condition<T>` is a partial shape of `T`. Each key names a field; each value says how that
field is constrained.

| Condition value     | Meaning                                                      |
| ------------------- | ------------------------------------------------------------ |
| a scalar, `Date`, … | equality, compared BY VALUE (`{ name: "Ada" }`)              |
| an array            | **containment** — the row's array holds every listed element |
| a nested object     | **partial match** — the listed keys hold, others are free    |
| an operator object  | the operators apply (`{ age: { $gte: 18 } }`)                |

A bare composite value always means _contained in_, never _equal to_: an array contains its
elements, an object contains its keys. Equality stays available and explicit as `$eq`, which is
deep.

**Every key in one object must hold.** `{ age: { $gt: 26, $lt: 32 } }` is a conjunction, and a
logical operator among the keys does not change that — `{ score: { $not: { $lt: 15 }, $lt: 25 } }`
means both. The same rule applies at every depth, including inside an `$and` / `$or` / `$not`.

Top-level `$and` / `$or` / `$not` combine whole conditions.

### Operators

| Group       | Operators                                                                    |
| ----------- | ---------------------------------------------------------------------------- |
| Existence   | `$exists`, `$eq`, `$neq`                                                     |
| Comparison  | `$gt`, `$gte`, `$lt`, `$lte`, `$between` (`number`/`Date`/`bigint`/`string`) |
| Fuzzy       | `$like`, `$ilike` (SQL `%`/`_` wildcards), `$regex`, `$similar`              |
| Arrays      | `$in`, `$nin`, `$all`, `$overlap`, `$contained`, `$length`                   |
| Containment | `$has` (plain JSON containment)                                              |
| Numbers     | `$mod` (`value % divisor === remainder`)                                     |
| Logical     | `$and`, `$or`, `$not`                                                        |

- `$exists` means **NOT NULL**, not key presence — the only reading a relational column can
  implement.
- Range operators order `number`, `Date`, `bigint` and `string`. Strings use **plain JS
  ordering**; the language does not reproduce a database collation, so a mixed-case or
  non-ASCII string range is a documented cross-driver divergence.
- `$has` is **plain containment** — the same thing each SQL dialect emits (`@>` /
  `JSON_CONTAINS`). Nested operators are not part of it. Against an array column the operand
  may be a single element: `{ tags: { $has: "a" } }`.
- `$in` / `$nin` / `$all` / `$overlap` / `$contained` compare with the language's single
  equality, the one `$eq` uses — Dates by instant, Buffers by content, objects by structure.
- `$similar` is PostgreSQL `pg_trgm` trigram search — it has no in-memory equivalent and
  **throws** when evaluated here.

### `null`, `undefined` and empty

These are three different things and are never interchangeable.

- **`undefined` means "not specified".** The key is ignored, at any depth — `{ age: undefined }`
  and `{ age: { $eq: undefined } }` both place no constraint. Stripping happens BEFORE any
  payload is shape-checked.
- **`null` means "explicitly null".** `$eq: null` / `$neq: null` are fully legitimate. A row
  value that is null or absent does not match a comparison operator (`$gt`, `$gte`, `$lt`,
  `$lte`, `$between`, `$mod`) — the row is filtered out, exactly as a database does it. A null
  OPERAND on one of those throws: `$gte: null` is not orderable.
- **A root `{}` means "no constraints"** and matches everything — that is how you ask for
  everything. A NAMED field's empty operator bag (`{ label: {} }`) throws: naming a field says
  you are constraining it. An empty `$and: []` / `$or: []` throws for the same reason.

### Malformed conditions throw

Presence decides that an operator applies; the payload is then shape-checked, and a wrong shape
is an error rather than a silently dropped clause. `$not` on a non-object, `$and`/`$or` on a
non-array, `$in`/`$nin`/`$all`/`$overlap`/`$contained` on a non-array, `$between`/`$mod` on a
non-pair, `$exists` on a non-boolean, `$length` on a non-number, `$regex` on a string,
`$like`/`$ilike` on a non-string, an unknown `$`-prefixed operator, and a condition operator at
the ROOT of a condition all throw.

## Usage

```ts
import { matches, Matcher } from "@lindorm/match";

const users = [
  { id: "1", name: "Ada", age: 36, tags: ["admin"], address: { city: "London" } },
  { id: "2", name: "Linus", age: 25, tags: ["user"], address: { city: "Helsinki" } },
];

matches(users[0], { age: { $gte: 18 } }); // true
matches(users[0], { tags: ["admin"] }); // true — containment
matches(users[0], { address: { city: "London" } }); // true — partial match

Matcher.filter(users, {
  $and: [{ name: { $ilike: "a%" } }, { address: { city: { $in: ["London", "Paris"] } } }],
});
Matcher.find(users, { id: { $eq: "1" } });
Matcher.findLast(users, { address: { city: "London" } });
Matcher.match({ age: 30 }, { age: { $gte: 18 } });
Matcher.remove(users, { name: { $regex: /^L/ } });
```

## API

| Export             | Signature                                                    | Description                         |
| ------------------ | ------------------------------------------------------------ | ----------------------------------- |
| `matches`          | `<T>(value: T, condition: Condition<T>) => boolean`          | Test one value against a condition. |
| `Matcher.filter`   | `<T>(array: T[], condition: Condition<T>) => T[]`            | Items that match.                   |
| `Matcher.find`     | `<T>(array: T[], condition: Condition<T>) => T \| undefined` | First match.                        |
| `Matcher.findLast` | `<T>(array: T[], condition: Condition<T>) => T \| undefined` | Last match.                         |
| `Matcher.match`    | `<T>(record: T, condition: Condition<T>) => boolean`         | Delegates to `matches`.             |
| `Matcher.remove`   | `<T>(array: T[], condition: Condition<T>) => T[]`            | Items that do not match.            |

The `Condition<T>`, `ConditionOperator<T>`, and `RootCondition<T>` types are exported for explicit
typing.

### The operator vocabulary

`ConditionOperatorKey` and `LogicalOperatorKey` are exported as const objects, with the type of the
same name, plus the guards `isConditionOperatorKey` and `isLogicalOperatorKey`.

```ts
import { ConditionOperatorKey, isConditionOperatorKey } from "@lindorm/match";

Object.values(ConditionOperatorKey); // ["$exists", "$eq", …]
isConditionOperatorKey("$ne"); // false
```

Conditions are written with the literal (`{ age: { $gte: 18 } }`), not with named access — the
artifact exists so that every implementation of the language derives its operator set from ONE
place, and so that each operator's contract is stated next to the key. `@lindorm/proteus` compiles
an exhaustive `switch` over it, which makes a missing branch a build failure rather than a clause
that silently matches every row.

## License

AGPL-3.0-or-later
