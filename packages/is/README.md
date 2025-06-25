# @lindorm/is

Light-weight collection of **type-guard helpers** & small runtime validators for  
Node.js / TypeScript projects.  Every function follows the familiar `isX` naming  
convention and returns a _type-predicate_ so the compiler automatically narrows  
your variable inside `if` statements.

The entire library is framework-agnostic, has **zero runtime dependencies** and  
weighs just a few hundred bytes once tree-shaken.

---

## Installation

```bash
npm install @lindorm/is
# or
yarn add @lindorm/is
```

Because every helper is a named export you can pull in only what you need and  
let your bundler shake away the rest:

```ts
import { isArray, isJwt } from '@lindorm/is';

if (isArray(input)) {
  // input is now strongly typed as any[]
}

if (isJwt(token)) {
  /* … */
}
```

---

## Available helpers

### Primitives

* `isArray`
* `isBoolean` / `isBooleanString`
* `isBuffer`
* `isDate` / `isDateString`
* `isFinite`
* `isNan`
* `isNull`
* `isNumber` / `isNumberString`
* `isString`
* `isUndefined`

### Objects & workflow

* `isClass` – detects ES6 classes / constructor functions
* `isError`
* `isFunction`
* `isObject` – strict `Object` check (excludes arrays / functions)
* `isObjectLike` – loose object check (arrays/functions **not** included)
* `isPromise`
* `isEmpty` – `null`, `undefined`, empty string/array/object
* `isEqual` – deep equality comparison (uses JSON semantics)

### URI / network

* `isUrl` – full URL validation (protocol + hostname…)
* `isUrlLike` – looser heuristic (accepts `/relative/path` etc.)

### JOSE helpers

* `isJwt` / `isJws` / `isJwe` – fast RegExp + header inspection
* `isWebToken` – generic helper that matches any of the above

All JOSE helpers perform a quick base64-url decode of the header to ensure the  
`alg` / `typ` fields look sane – keeping you safe from obvious nonsense tokens.

---

## Example

```ts
import {
  isArray,
  isEmpty,
  isEqual,
  isJwt,
  isUrlLike,
} from '@lindorm/is';

export function handle(input: unknown) {
  if (isEmpty(input)) return undefined;

  if (isArray(input)) {
    return input.filter((x) => !isEmpty(x));
  }

  if (isJwt(String(input))) {
    // do something secure…
  }

  if (isUrlLike(String(input))) {
    // treat as link
  }

  // deep compare with cached value
  if (isEqual(input, cached)) {
    return cached;
  }

  return input;
}
```

---

## Contributing

1. Clone the monorepo and `cd packages/is`  
2. `npm ci && npm run test`  
3. Add tests for any new helper you introduce  
4. Open a PR – CI has to be green 🟢

---

## License

AGPL-3.0-or-later – © Lindorm, 2024
