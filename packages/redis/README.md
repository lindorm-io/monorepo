# @lindorm/redis

Typed **Redis data-layer** built on top of
[ioredis](https://github.com/redis/ioredis).  The driver follows the same repository pattern as the
Mongo / Postgres / Mnemos counterparts, making it trivial to swap between them.

---

## Highlights

* Central `RedisSource` that owns the ioredis connection and lazy-creates repositories
* `RedisRepository` with familiar CRUD semantics (`insert`, `update`, `save`, `find` …)
* Handles TTL, version columns and soft deletes via entity metadata
* Namespace support for multi-tenant applications
* First-class logger integration

---

## Installation

```bash
npm install @lindorm/redis
# or
yarn add @lindorm/redis
```

The package depends on a running Redis instance.  A docker compose file is bundled for convenience:

```bash
docker compose -f ./packages/redis/docker-compose.yml up -d
```

---

## Quick start

```ts
import { RedisSource } from '@lindorm/redis';
import { Logger } from '@lindorm/logger';
import { Entity, PrimaryKeyColumn } from '@lindorm/entity';

@Entity()
class Session {
  @PrimaryKeyColumn()
  id!: string;

  data!: string;
}

const source = new RedisSource({
  url: 'redis://localhost:6379/0',
  entities: [Session],
  namespace: 'prod',
  logger: new Logger({ readable: true }),
});

await source.setup();

const repo = source.repository(Session);

await repo.insert(repo.create({ id: 's1', data: 'hello' }));

console.log(await repo.find()); // → [ Session { … } ]
```

---

## API surface (excerpt)

### `RedisSource`

```ts
new RedisSource({
  url?: string;                 // or config?: RedisOptions
  config?: RedisOptions;        // forwarded to ioredis
  entities?: [User, …];
  namespace?: string;           // prefix all keys
  logger: ILogger;              // required
});

source.connect();
source.disconnect();
source.setup();

source.repository(Entity, opts?) → RedisRepository
source.clone({ logger? }) → RedisSource // shares underlying connection
```

### `RedisRepository`

Implements the standard Lindorm repository contract (see `@lindorm/mnemos` for details) with Redis
hash/JSON under the hood.

---

## TypeScript

Complete typings included.  No additional runtime dependencies besides `ioredis` & other Lindorm
packages.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

