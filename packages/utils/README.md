## @lindorm/utils

A grab-bag of small, tree-shakeable helpers shared across the Lindorm packages: deep object diff/merge, predicate-based array querying, abort-signal composition, and other day-to-day utilities.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/utils
```

## Features

- Deep object/array `diff` and `merge` with cycle safety
- `filter` / `find` / `findLast` / `remove` over arrays using a `DeepPartial` shape
- `Predicated` class with a richer query DSL (`$and`, `$or`, `$not`, `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$regex`, `$like`, `$ilike`, `$between`, `$length`, `$mod`, `$exists`, `$all`, `$overlap`, `$contained`)
- `combineSignals` and `isAbortReason` helpers for `AbortSignal` composition and the shared `AbortReason` shape
- `removeEmpty` and `removeUndefined` for recursive object/array cleanup
- `parseStringRecord` for coercing `Record<string, string>` (e.g. query strings) into typed values
- `sortKeys` for deterministic JSON key ordering
- `safelyParse`, `sleep`, `wait`, `noop`, `noopAsync`, `lazyFactory`, `uniq`, `uniqFlat`

## Usage

### Diff and merge

```ts
import { diff, merge } from "@lindorm/utils";

const patch = diff({ a: 1, b: { x: 1 } }, { a: 1, b: { x: 2, y: 3 } });
// { b: { x: 2, y: 3 } }

const merged = merge({ a: 1, list: [1] }, { a: 2, list: [2] }, { c: 3 });
// { a: 2, list: [1, 2], c: 3 }
```

`diff` returns the `DeepPartial` patch needed to turn `source` into `target`. Removed keys appear with value `undefined`. Arrays are overwritten, not recursed. `merge` deep-merges objects and concatenates arrays; mixing array and non-array (or object and non-object) at the same key throws `TypeError`.

### Querying arrays with a partial shape

```ts
import { filter, find, findLast, remove } from "@lindorm/utils";

const users = [
  { id: "1", name: "Ada", address: { city: "London" } },
  { id: "2", name: "Linus", address: { city: "Helsinki" } },
];

find(users, { name: "Ada" });
filter(users, { address: { city: "London" } });
findLast(users, { address: { city: "London" } });
remove(users, { id: "2" });
```

The partial shape is matched recursively against each item.

### Querying with the predicate DSL

```ts
import { Predicated } from "@lindorm/utils";

Predicated.filter(users, {
  $and: [{ name: { $ilike: "a%" } }, { address: { city: { $in: ["London", "Paris"] } } }],
});

Predicated.match({ age: 30 }, { age: { $gte: 18 } });
Predicated.find(users, { id: { $eq: "1" } });
Predicated.remove(users, { name: { $regex: /^L/ } });
```

`Predicated` exposes `filter`, `find`, `findLast`, `match`, and `remove` as static methods.

### Abort signal helpers

```ts
import { combineSignals, isAbortReason } from "@lindorm/utils";

const controller = new AbortController();
const signal = combineSignals(controller.signal, request.signal);

controller.abort({ kind: "request-timeout", timeoutMs: 5000 });

if (isAbortReason(signal?.reason)) {
  // narrowed to AbortReason from @lindorm/types
}
```

`combineSignals` returns `undefined` when both inputs are `undefined`, returns the other input when only one is provided, and otherwise returns `AbortSignal.any([a, b])`. `isAbortReason` is a type guard that accepts the `kind` values: `client-disconnect`, `request-timeout`, `server-shutdown`, `parent-aborted`, `rate-limit-exceeded`, `breaker-open`, `manual`.

### Object/array cleanup

```ts
import { removeEmpty, removeUndefined, sortKeys } from "@lindorm/utils";

removeEmpty({ a: 1, b: null, c: "", d: [], e: {} });
// { a: 1 }

removeUndefined({ a: 1, b: undefined, c: { d: undefined, e: 2 } });
// { a: 1, c: { e: 2 } }

sortKeys({ b: 1, a: { d: 1, c: 1 } });
// { a: { c: 1, d: 1 }, b: 1 }
```

`removeEmpty` strips `null`, `undefined`, `""`, `[]`, and `{}` recursively. `removeUndefined` strips only `undefined`. Both accept either an array or an object and throw `TypeError` for other inputs.

### Parsing string records

```ts
import { parseStringRecord } from "@lindorm/utils";

parseStringRecord({
  flag: "true",
  count: "42",
  when: "2024-01-01T00:00:00.000Z",
  list: '["a", "b"]',
  raw: "hello",
});
// { flag: true, count: 42, when: Date, list: ["a", "b"], raw: "hello" }
```

Strings that look like booleans, numbers, ISO date strings, JSON arrays/objects, `"null"`, or `"undefined"` are coerced to their typed value. Everything else is returned URL-decoded as a string. Array values are mapped element-wise.

### Other helpers

```ts
import { lazyFactory, safelyParse, sleep, uniq, wait } from "@lindorm/utils";

const config: Record<string, unknown> = {};
lazyFactory(config, "client", () => createClient());
config.client; // factory invoked once, then cached

safelyParse('{"a":1}'); // { a: 1 }
safelyParse("not json"); // "not json"

uniq([1, 1, 2, 3, 3]); // [1, 2, 3]

await sleep(250);

await wait(() => isReady(), 5000, 50);
```

## API

### Diff / merge

| Export       | Signature                                                        | Description                                                                                                                                                   |
| ------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diff`       | `(source, target) => DeepPartial<T> \| T`                        | Overloaded for objects (returns patch) and arrays (returns items in `target` not in `source`). Throws `TypeError` if the two arguments are not the same kind. |
| `diffArray`  | `(source: any[], target: T[]) => T[]`                            | Items present in `target` but not in `source`, compared with deep equality.                                                                                   |
| `diffObject` | `(source, target) => DeepPartial<T>`                             | Object-only diff used by `diff`. Removed keys appear with `undefined`; cycle-safe.                                                                            |
| `diffAny`    | `(source: any[], target: T[]) => T[]`                            | Symmetric difference: items in either side that are not in the other.                                                                                         |
| `merge`      | `<T>(origin: DeepPartial<T>, ...records: DeepPartial<T>[]) => T` | Deep-merge objects; concatenate arrays. Mismatched value kinds throw `TypeError`.                                                                             |

### Array querying (partial-shape)

| Export     | Signature                                                    | Description                                                                               |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `filter`   | `<T>(array: T[], partial: DeepPartial<T>) => T[]`            | Items that recursively match the partial shape.                                           |
| `find`     | `<T>(array: T[], partial: DeepPartial<T>) => T \| undefined` | First match.                                                                              |
| `findLast` | `<T>(array: T[], partial: DeepPartial<T>) => T \| undefined` | Last match.                                                                               |
| `remove`   | `<T>(array: T[], partial: DeepPartial<T>) => T[]`            | Items that do not match the partial shape. Returns a new array; the input is not mutated. |

### Predicate DSL

| Export                | Signature                                                    | Description                           |
| --------------------- | ------------------------------------------------------------ | ------------------------------------- |
| `Predicated.filter`   | `<T>(array: T[], predicate: Predicate<T>) => T[]`            | DSL-based filter.                     |
| `Predicated.find`     | `<T>(array: T[], predicate: Predicate<T>) => T \| undefined` | First DSL match.                      |
| `Predicated.findLast` | `<T>(array: T[], predicate: Predicate<T>) => T \| undefined` | Last DSL match.                       |
| `Predicated.match`    | `<T>(record: T, predicate: Predicate<T>) => boolean`         | Test a single record against the DSL. |
| `Predicated.remove`   | `<T>(array: T[], predicate: Predicate<T>) => T[]`            | Items that do not satisfy the DSL.    |

The `Predicate<T>` type lives in `@lindorm/types` — import it from there if you need the type explicitly. Supported operators: `$and`, `$or`, `$not`, `$eq`, `$neq`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$regex`, `$like`, `$ilike`, `$between`, `$length`, `$mod`, `$exists`, `$all`, `$overlap`, `$contained`.

### Abort signals

| Export           | Signature                                                        | Description                                                                |
| ---------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `combineSignals` | `(a?: AbortSignal, b?: AbortSignal) => AbortSignal \| undefined` | Returns `undefined`, the only defined input, or `AbortSignal.any([a, b])`. |
| `isAbortReason`  | `(value: unknown) => value is AbortReason`                       | Type guard for the `AbortReason` shape from `@lindorm/types`.              |

### Object/array cleanup

| Export            | Signature          | Description                                                                                                             |
| ----------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `removeEmpty`     | `<T>(arg: T) => T` | Recursively strips `null`, `undefined`, `""`, `[]`, and `{}`. Accepts an array or object; throws `TypeError` otherwise. |
| `removeUndefined` | `<T>(arg: T) => T` | Recursively strips `undefined` only. Same input rules as `removeEmpty`.                                                 |
| `sortKeys`        | `<T>(arg: T) => T` | Returns a new object with keys sorted alphabetically at every depth.                                                    |

### String parsing

| Export              | Signature                                                                               | Description                                                                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `parseStringRecord` | `<T = any>(record: Dict<string \| undefined \| Array<string \| undefined>>) => Dict<T>` | Coerces booleans, numbers, ISO date strings, JSON arrays/objects, `"null"`, and `"undefined"` to their typed values. Other strings are URL-decoded. |
| `safelyParse`       | `<T = any>(value: string) => T`                                                         | `JSON.parse(value)` that returns the original string instead of throwing.                                                                           |

### Async helpers

| Export      | Signature                                                                         | Description                                                                                                                                         |
| ----------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sleep`     | `(ms: number) => Promise<void>`                                                   | `setTimeout`-based delay.                                                                                                                           |
| `wait`      | `(callback: () => boolean, timeout?: number, interval?: number) => Promise<void>` | Polls `callback` until it returns `true`. Defaults: `timeout = 10000`, `interval = 50`. Throws `Error("Timeout waiting for condition")` on timeout. |
| `noop`      | `() => void`                                                                      | Empty function.                                                                                                                                     |
| `noopAsync` | `() => Promise<void>`                                                             | Empty async function.                                                                                                                               |

### Misc

| Export        | Signature                                              | Description                                                                                                           |
| ------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `lazyFactory` | `<T>(on: Dict, key: string, factory: () => T) => void` | Defines an enumerable, configurable getter on `on[key]` that invokes `factory` on first access and caches the result. |
| `uniq`        | `<T = any>(array: any[]) => T[]`                       | Deduplicates by `Set` identity.                                                                                       |
| `uniqFlat`    | `<T = any>(...args) => T[]`                            | Flattens up to five levels of nesting before deduplicating.                                                           |

## License

AGPL-3.0-or-later
