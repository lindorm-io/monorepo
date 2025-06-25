# @lindorm/mnemos

> _Greek μνήμη (mnēmē) – "memory"_

`@lindorm/mnemos` is a **zero-dependency, in-memory data source** for the Lindorm repository
ecosystem.  It implements the same high-level API as
[`@lindorm/mongo`](../mongo) / `@lindorm/redis` / `@lindorm/postgres` which makes it a perfect fit
for **unit tests**, **prototyping** and small one-off scripts where spinning up a real database is
overkill.

---

## Highlights

* Entity first: relies on `@lindorm/entity` metadata and therefore supports decorators like
  `@PrimaryKeyColumn`, `@VersionColumn`, `@ExpiryDateColumn` …
* Fully **typed** – repositories preserve your entity type, including primary keys & columns.
* Supports TTL & version columns, automatic primary key increments, soft deletes, …
* Identical repository/collection API to the production drivers → swap databases without hassle.
* Bundles HTTP / WebSocket **middleware** helpers for the
  [`@lindorm/pylon`](https://github.com/fhitc/lindorm-monorepo/tree/main/packages/pylon) framework.

---

## Installation

```bash
npm install @lindorm/mnemos
# or
yarn add @lindorm/mnemos
```

The package only depends on other Lindorm utilities (`@lindorm/entity`, `@lindorm/logger`) – no
native addons, no external services.

---

## Basic usage

```ts
import { MnemosSource } from '@lindorm/mnemos';
import { Logger } from '@lindorm/logger';
import { Entity, PrimaryKeyColumn } from '@lindorm/entity';

@Entity()
class User {
  @PrimaryKeyColumn()
  id!: string;

  name!: string;
}

const source = new MnemosSource({
  entities: [User],
  logger: new Logger({ readable: true }),
});

const repo = source.repository(User);

const alice = repo.create({ id: 'u1', name: 'Alice' });

await repo.insert(alice);

console.log(await repo.find());        // → [ User { … } ]
console.log(await repo.exists({ name: 'Alice' })); // → true
```

Because the library keeps everything in plain JavaScript objects you can also **clone** the source
and share a common dataset across multiple test suites:

```ts
const shared = new MnemosSource({ entities: [User], logger });

// Each test gets its own isolated repository
beforeEach(() => {
  testCtx.source = shared.clone({ logger: testCtx.logger });
});
```

---

## API overview

### Source

```ts
new MnemosSource({
  entities: [User, Post, …],
  logger,                // mandatory
});

source.repository(Entity, options?) → MnemosRepository
source.clone({ logger? }) → MnemosSource // shares underlying cache
```

### Repository (partial)

The repository exposes the common Lindorm data-layer contract:

```ts
repo.create(attrs)        // instantiate + set metadata (timestamps, version…)
repo.validate(entity)
repo.insert(entity)
repo.update(entity)
repo.save(entity)         // insert or update depending on version / primary source

repo.find(predicate?)     // array
repo.findOne(predicate)   // entity | null
repo.exists(predicate)    // boolean
repo.count(predicate)     // number
repo.delete(predicate)    // hard delete
repo.destroy(entity)      // lifecycle hook aware delete

repo.ttl(predicate)       // seconds until expiry (requires @ExpiryDateColumn)
```

All predicate parameters use the tiny `@lindorm/utils` _Predicated_ DSL which supports `$and`,
`$or`, comparison operators (`$gt`, `$lte` …) and nested paths.

---

## Middleware helpers

Adding a Mnemos source / repository / single entity to a
[`@lindorm/pylon`](../pylon) HTTP or WebSocket context is a one-liner:

```ts
import {
  createHttpMnemosSourceMiddleware,
  createHttpMnemosRepositoryMiddleware,
} from '@lindorm/mnemos';

app.use(createHttpMnemosSourceMiddleware(source));
app.use(createHttpMnemosRepositoryMiddleware(User, {
  repository: source.repository(User),
}));
```

---

## When **not** to use Mnemos

`@lindorm/mnemos` keeps _everything_ in memory – once your process crashes or restarts the data is
lost.  Use a persistent driver such as `@lindorm/mongo`, `@lindorm/postgres` or `@lindorm/redis`
for anything beyond testing and local prototyping.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

