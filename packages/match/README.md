## @lindorm/match

Declarative, Mongo-style matching for in-memory data. Describe what you want with a
`Condition<T>` object and test values against it with `matches`, or query arrays with the
`Matcher` helpers.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/match
```

## Conditions

A `Condition<T>` is a partial shape of `T`. A plain value matches by equality; nested objects
recurse; an operator object (`{ $gte: 18 }`) applies the operators to that field. **Every operator
in one object must hold** — `{ age: { $gt: 26, $lt: 32 } }` is a conjunction. Top-level `$and` /
`$or` / `$not` combine whole conditions.

### Operators

| Group       | Operators                                                       |
| ----------- | --------------------------------------------------------------- |
| Existence   | `$exists`, `$eq`, `$neq`                                        |
| Comparison  | `$gt`, `$gte`, `$lt`, `$lte`, `$between` (numbers and `Date`)   |
| Fuzzy       | `$like`, `$ilike` (SQL `%`/`_` wildcards), `$regex`, `$similar` |
| Arrays      | `$in`, `$nin`, `$all`, `$overlap`, `$contained`, `$length`      |
| Containment | `$has` (deep-partial object/array match)                        |
| Numbers     | `$mod` (`value % divisor === remainder`)                        |
| Logical     | `$and`, `$or`, `$not`                                           |

`$similar` is PostgreSQL `pg_trgm` trigram search — it has no in-memory equivalent and **throws**
when evaluated here. An unrecognised operator, or an operator applied to an unsupported value type,
also throws.

## Usage

```ts
import { matches, Matcher } from "@lindorm/match";

const users = [
  { id: "1", name: "Ada", age: 36, address: { city: "London" } },
  { id: "2", name: "Linus", age: 25, address: { city: "Helsinki" } },
];

matches(users[0], { age: { $gte: 18 } }); // true

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

## License

AGPL-3.0-or-later
