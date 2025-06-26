# @lindorm/url

Small set of **URL manipulation helpers** that simplify building, validating and parsing URLs in
Node.js & browser environments.  All utilities are zero-dependency wrappers around the native `URL`
class.

---

## Installation

```bash
npm install @lindorm/url
# or
yarn add @lindorm/url
```

---

## Helper overview

• `createUrl(pathOrUrl, options?)` – smart builder that handles base urls, host+port, params & query
• `createBaseUrl({ host, port, base })` – constructs a URL instance for subsequent calls
• `extractSearchParams(url)` – returns search params as plain JS object
• `getValidUrl(urlLike)` – returns valid `URL` or throws
• `getPlainUrl(url)` – strip query and hash → string path only

All helpers are available as named exports:

```ts
import { createUrl, getPlainUrl } from '@lindorm/url';
```

---

## Quick examples

### Build url with path params & query

```ts
const url = createUrl('/users/:id', {
  host: 'https://api.example.com',
  params: { id: 'u1' },
  query: { include: 'posts', page: 2 },
});

console.log(url.toString());
// https://api.example.com/users/u1?include=posts&page=2
```

### Derive from existing URL

```ts
const next = createUrl(new URL('https://example.com/foo?bar=1'), {
  params: {},
  query: { baz: 2 }, // merged with existing search params
});

// → https://example.com/foo?bar=1&baz=2
```

---

## TypeScript

Helper generics let you specify custom param / query shapes:

```ts
type Params = { id: string };
type Query  = { filter?: string };

const url = createUrl<Params, Query>('/users/:id', { … });
```

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

