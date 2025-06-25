# @lindorm/mongo

Type-safe **MongoDB data-layer** that integrates tightly with the Lindorm entity metadata system. It
provides a high-level repository abstraction similar to TypeORM / MikroORM but focuses on
immutability, event sourcing and security.

---

## Key features

* `MongoSource` – central factory that keeps a single `MongoClient` instance and maps entities /
  files to repositories and GridFS buckets
* `MongoRepository` – CRUD, optimistic locking, TTL / soft delete helpers, auto-index creation
* `MongoBucket` – tiny wrapper around [`GridFSBucket`](https://www.mongodb.com/docs/manual/core/gridfs/)
  with typed `File` entities
* Identical API to the in-memory / Redis / Postgres drivers – swap databases without hassle
* Full logger integration via `@lindorm/logger`

---

## Installation

```bash
npm install @lindorm/mongo
# or
yarn add @lindorm/mongo
```

You obviously need a running MongoDB instance. For local development you can spin one up with

```bash
docker compose -f ./packages/mongo/docker-compose.yml up -d
```

---

## Quick start

```ts
import { MongoSource } from '@lindorm/mongo';
import { Logger } from '@lindorm/logger';
import { Entity, PrimaryKeyColumn, VersionColumn } from '@lindorm/entity';

@Entity()
class BlogPost {
  @PrimaryKeyColumn()
  id!: string;

  @VersionColumn()
  version!: number;

  title!: string;
  body!: string;
}

const source = new MongoSource({
  url: 'mongodb://localhost:27017',
  database: 'blog',
  entities: [BlogPost],
  logger: new Logger({ readable: true }),
});

await source.connect();
await source.setup(); // creates collections + indexes

const posts = source.repository(BlogPost);

const first = posts.create({ id: 'p1', title: 'Hello', body: 'World' });

await posts.insert(first);
```

---

## API surface (excerpt)

### Source

```ts
new MongoSource({
  url: 'mongodb://…',
  database: 'name',
  entities: [User, …],
  files: [AvatarImage, …],
  namespace?: 'prod' | 'test', // prefixes collection names
  logger,
  config?: MongoClientOptions,  // forwarded to mongodb driver
});

source.connect();
source.disconnect();
source.setup(); // create collections, indexes, buckets

source.repository(Entity, opts?) → MongoRepository
source.bucket(File, opts?)      → MongoBucket
```

### Repository highlights

* **Optimistic locking** based on `@VersionColumn`
* Automatic predicates that respect `@DeleteDateColumn` and `@ExpiryDateColumn`
* `getNextIncrement` helper for numeric ids (uses a separate collection under the hood)

---

## Testing

The package ships with an extensive integration test-suite. You can run it locally via:

```bash
cd packages/mongo
docker compose up -d   # start MongoDB
npm test
```

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

