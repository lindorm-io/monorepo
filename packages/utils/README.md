# @lindorm/utils

Grab-bag of **tiny, tree-shakeable helpers** used across the Lindorm ecosystem.  Every function is a
named export so you can cherry-pick exactly what you need and let your bundler remove the rest.

The library has **zero runtime dependencies** and is safe to use in both Node.js and browser
environments (where the respective helper makes sense).

---

## Installation

```bash
npm install @lindorm/utils
# or
yarn add @lindorm/utils
```

---

## Highlighted helpers

| Function            | Description                                                  |
|---------------------|--------------------------------------------------------------|
| `diff(a, b)`        | Deep JSON diff – returns `{ added, removed, updated }`       |
| `filter(list, pred)`| Synchronous array filter that accepts [`Predicate<T>`]       |
| `find(list, pred)`  | Like `Array.find` but with predicate DSL support             |
| `findLast(list,p)`  | ES2023 `Array.findLast` polyfill with predicate DSL          |
| `merge(a,b)`        | Deep merge objects (arrays concatenated)                     |
| `noop()`            | No-operation func – useful placeholder                       |
| `parseStringRecord` | Turns `Record<string,string>` into typed object via mapper    |
| `remove(list, item)`| Mutates & returns list without item                          |
| `removeEmpty(obj)`  | Removes keys with `null | '' | [] | {}` recursively          |
| `removeUndefined`   | Removes keys with `undefined` recursively                    |
| `safelyParse(json)` | `JSON.parse` wrapper that returns `undefined` on error       |
| `sleep(ms)`         | async delay (`await sleep(250)`)                             |
| `sortKeys(obj)`     | Deterministic JSON key ordering                              |
| `uniq(list)`        | Returns new array with duplicates removed                    |

Helpers that rely on the **predicate DSL** consume objects like:

```ts
{ $and: [ { id: 'u1' }, { age: { $gt: 18 } } ] }
```

The DSL is defined in `@lindorm/utils/src/types` and shared with repository drivers.

---

## Example

```ts
import { diff, sleep, uniq } from '@lindorm/utils';

const changes = diff({ a: 1 }, { a: 2, b: 3 });

console.log(changes.updated); // { a: 2 }

await sleep(500);

console.log(uniq([1,2,2,3])); // [1,2,3]
```

---

## TypeScript

All helpers are fully typed and many export additional utility types (e.g. `Predicate<T>`,
`Predicated.*`) that make writing data-layer code easier.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

