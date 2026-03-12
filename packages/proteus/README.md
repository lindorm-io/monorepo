# @lindorm/proteus

A multi-driver ORM for TypeScript built on TC39 decorators. Define your entities once and run them against PostgreSQL, MySQL, SQLite, MongoDB, Redis, or an in-memory store with zero code changes.

## Installation

```bash
npm install @lindorm/proteus
```

Peer dependencies vary by driver:

| Driver     | Peer Dependency          |
| ---------- | ------------------------ |
| PostgreSQL | `pg` >= 8.18             |
| MySQL      | `mysql2` >= 3.19         |
| SQLite     | `better-sqlite3` >= 12.6 |
| MongoDB    | `mongodb` >= 6.17        |
| Redis      | `ioredis` >= 5.10        |
| In-Memory  | none                     |

## Quick Start

```typescript
import {
  Entity,
  PrimaryKeyField,
  VersionField,
  CreateDateField,
  UpdateDateField,
  Field,
  Nullable,
  Default,
  ProteusSource,
} from "@lindorm/proteus";

// 1. Define an entity
@Entity()
class User {
  @PrimaryKeyField()
  id!: string;

  @VersionField()
  version!: number;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Nullable()
  @Field("string")
  email!: string | null;

  @Default(0)
  @Field("integer")
  age!: number;
}

// 2. Create a source and connect
const source = new ProteusSource({
  driver: "postgres",
  host: "localhost",
  port: 5432,
  database: "myapp",
  user: "postgres",
  password: "secret",
  entities: [User],
  synchronize: true,
  logger, // ILogger instance
});

await source.connect();
await source.setup();

// 3. Use the repository
const repo = source.repository(User);

const user = await repo.insert({ name: "Alice", email: "alice@example.com", age: 30 });
const found = await repo.findOne({ name: "Alice" });
user.age = 31;
await repo.update(user);
await repo.destroy(user);

// 4. Disconnect
await source.disconnect();
```

## Table of Contents

- [Drivers](#drivers)
- [Entities](#entities)
- [Field Types](#field-types)
- [Decorators](#decorators)
- [Repository API](#repository-api)
- [Query Builder](#query-builder)
- [Predicates](#predicates)
- [Relations](#relations)
- [Transactions](#transactions)
- [Lifecycle Hooks](#lifecycle-hooks)
- [Soft Deletes & Expiry](#soft-deletes--expiry)
- [Temporal Versioning](#temporal-versioning)
- [Filters](#filters)
- [Caching](#caching)
- [Field-Level Encryption](#field-level-encryption)
- [Naming Strategies](#naming-strategies)
- [Entity Subscribers](#entity-subscribers)
- [Per-Request Isolation](#per-request-isolation)
- [Schema Synchronization & Migrations](#schema-synchronization--migrations)
- [CLI](#cli)
- [Errors](#errors)

## Drivers

Proteus supports six database backends. Swap drivers by changing the `driver` field — your entity definitions and repository code stay the same.

### PostgreSQL

```typescript
new ProteusSource({
  driver: "postgres",
  url: "postgresql://user:pass@localhost:5432/mydb",
  // — or individual fields: host, port, user, password, database
  pool: { min: 2, max: 10, connectionTimeoutMillis: 5000 },
  ssl: true,
  applicationName: "my-service",
  statementTimeout: 30000,
  slowQueryThresholdMs: 200,
  synchronize: true,
  entities: [User],
  logger,
});
```

Full ACID transactions with savepoints. Connection pooling via `pg.Pool`. DDL synchronization and migrations.

### MySQL

```typescript
new ProteusSource({
  driver: "mysql",
  host: "localhost",
  port: 3306,
  user: "root",
  password: "secret",
  database: "mydb",
  pool: { min: 2, max: 10 },
  charset: "utf8mb4",
  compress: true,
  slowQueryThresholdMs: 200,
  synchronize: true,
  entities: [User],
  logger,
});
```

Full ACID transactions with savepoints. Connection pooling via `mysql2`. MySQL 8.0.19+ required.

### SQLite

```typescript
new ProteusSource({
  driver: "sqlite",
  filename: "./data.db", // or ":memory:"
  busyTimeout: 5000,
  pragmas: { journal_mode: "wal", foreign_keys: "on" },
  synchronize: true,
  entities: [User],
  logger,
});
```

WAL mode and foreign keys enabled by default. SAVEPOINT-based nested transactions. Powered by `better-sqlite3`.

### MongoDB

```typescript
new ProteusSource({
  driver: "mongo",
  url: "mongodb://localhost:27017",
  database: "mydb",
  replicaSet: "rs0",
  writeConcern: { w: "majority", j: true },
  readPreference: "primaryPreferred",
  authSource: "admin",
  synchronize: true,
  entities: [User],
  logger,
});
```

ACID transactions require a replica set. Automatic index synchronization, TTL indexes for `@ExpiryDateField`, shadow collections for temporal versioning.

### Redis

```typescript
new ProteusSource({
  driver: "redis",
  host: "localhost",
  port: 6379,
  password: "secret",
  db: 0,
  connectTimeout: 5000,
  commandTimeout: 3000,
  keepAlive: 30000,
  connectionName: "my-service",
  entities: [User],
  logger,
});
```

Key-value storage using `ioredis`. No transaction support — operations execute without atomicity. Best suited for caching entities or session-like data.

### In-Memory

```typescript
new ProteusSource({
  driver: "memory",
  entities: [User],
  logger,
});
```

Full transaction support with snapshot isolation. Zero config. Ideal for unit tests and prototyping.

### Common Options

All drivers accept these base options:

| Option      | Type                           | Description                                        |
| ----------- | ------------------------------ | -------------------------------------------------- |
| `entities`  | `Array<Constructor \| string>` | Entity classes or glob patterns                    |
| `namespace` | `string`                       | Schema (SQL), database (Mongo), key prefix (Redis) |
| `naming`    | `"snake" \| "camel" \| "none"` | Column name strategy (default: `"none"`)           |
| `cache`     | `{ adapter, ttl? }`            | Query caching configuration                        |
| `amphora`   | `IAmphora`                     | Key store for `@Encrypted` fields                  |
| `context`   | `unknown`                      | Passed to hooks and lifecycle callbacks            |
| `logger`    | `ILogger`                      | **Required.** Logger instance                      |

SQL drivers, MongoDB, and SQLite also accept schema management options:

| Option            | Type                   | Description                         |
| ----------------- | ---------------------- | ----------------------------------- |
| `synchronize`     | `boolean \| "dry-run"` | Auto-sync schema on setup           |
| `migrations`      | `Array<string>`        | Glob patterns for migration files   |
| `migrationsTable` | `string`               | Custom migrations ledger table name |
| `runMigrations`   | `boolean`              | Run pending migrations on setup     |

## Entities

An entity is a class decorated with `@Entity()` that maps to a database table or collection. At minimum, every entity needs a primary key.

```typescript
@Entity()
class User {
  @PrimaryKeyField() // UUID, auto-generated
  id!: string;

  @VersionField() // optimistic locking counter
  version!: number;

  @CreateDateField() // set automatically on insert
  createdAt!: Date;

  @UpdateDateField() // set automatically on every update
  updatedAt!: Date;

  @Field("string")
  name!: string;
}
```

### Custom Table Name

```typescript
@Entity({ name: "app_users" })
class User {
  /* ... */
}
```

### Namespace (Schema)

```typescript
@Namespace("billing")
@Entity()
class Invoice {
  /* ... */
}
```

### Integer Auto-Increment Primary Key

```typescript
@Entity()
class Post {
  @PrimaryKey()
  @Field("integer")
  @Generated("increment")
  id!: number;

  // ...
}
```

### Composite Primary Key

```typescript
@PrimaryKey<typeof OrderItem>(["orderId", "productId"])
@Entity()
class OrderItem {
  @Field("uuid")
  orderId!: string;

  @Field("uuid")
  productId!: string;

  @Field("integer")
  quantity!: number;
}
```

### Scoped Entities (Multi-Tenancy)

```typescript
@Entity()
class Resource {
  @PrimaryKeyField()
  id!: string;

  @ScopeField() // automatically partitions queries by scope value
  tenantId!: string;

  @Field("string")
  name!: string;
}
```

### Zod Validation

```typescript
import { z } from "zod";

const userSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

@Schema(userSchema)
@Entity()
class User {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Field("string")
  email!: string;
}

// Validates automatically on insert/update, or manually:
repo.validate(user);
```

### Embedded Value Objects

```typescript
@Embeddable()
class Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;

  @Field("string")
  zip!: string;
}

@Entity()
class User {
  @PrimaryKeyField()
  id!: string;

  @Embedded(() => Address)
  address!: Address;

  @EmbeddedList(() => Address)
  previousAddresses!: Address[];
}
```

### Inheritance

```typescript
@Entity()
@Inheritance("single-table")
@Discriminator("type")
class Vehicle {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  make!: string;
}

@Entity()
@DiscriminatorValue("car")
class Car extends Vehicle {
  @Field("integer")
  doors!: number;
}

@Entity()
@DiscriminatorValue("truck")
class Truck extends Vehicle {
  @Field("float")
  payloadTons!: number;
}
```

## Field Types

The `@Field(type)` decorator accepts these type strings:

| Category       | Types                                                                 |
| -------------- | --------------------------------------------------------------------- |
| Boolean        | `boolean`                                                             |
| Integer        | `integer`, `smallint`, `bigint`                                       |
| Floating Point | `float`, `real`, `decimal`                                            |
| String         | `string`, `text`, `varchar`, `uuid`, `enum`                           |
| Logical        | `email`, `url`                                                        |
| Date/Time      | `timestamp`, `date`, `time`, `interval`                               |
| Binary         | `binary`                                                              |
| Structured     | `json`, `object`, `array`                                             |
| Network        | `inet`, `cidr`, `macaddr`                                             |
| Geometric      | `point`, `line`, `lseg`, `box`, `path`, `polygon`, `circle`, `vector` |
| XML            | `xml`                                                                 |

### Examples

```typescript
@Field("json")
metadata!: Record<string, unknown>;

@Field("array", { arrayType: "string" })
tags!: string[];

@Field("decimal")
@Precision(10)
@Scale(2)
price!: number;

@Field("enum")
@Enum(StatusEnum)
status!: StatusEnum;

@Field("boolean")
@Default(true)
active!: boolean;

@Nullable()
@Field("timestamp")
lastLoginAt!: Date | null;

@Field("vector")
embedding!: number[];
```

## Decorators

### Entity & Class-Level

| Decorator                      | Description                             |
| ------------------------------ | --------------------------------------- |
| `@Entity(options?)`            | Mark class as a persistent entity       |
| `@AbstractEntity()`            | Mapped superclass — no table of its own |
| `@Embeddable()`                | Embeddable value type                   |
| `@Namespace(ns)`               | Set schema/database/prefix              |
| `@Schema(zodSchema)`           | Attach Zod validation                   |
| `@Cache(ttl?)`                 | Enable per-entity query caching         |
| `@Filter(options)`             | Declare parameterized WHERE filter      |
| `@Inheritance(strategy)`       | `"single-table"` or `"joined"`          |
| `@Discriminator(key)`          | Discriminator column name               |
| `@DiscriminatorValue(value)`   | Subclass discriminator value            |
| `@DefaultOrder(order)`         | Default sort order for queries          |
| `@Check(expression, options?)` | Class-level check constraint            |
| `@Index(keys, options?)`       | Composite index                         |
| `@Unique(keys, options?)`      | Composite unique constraint             |
| `@PrimaryKey(keys)`            | Composite primary key                   |

### Field Decorators

| Decorator                  | Description                       |
| -------------------------- | --------------------------------- |
| `@Field(type, options?)`   | General-purpose column            |
| `@PrimaryKeyField()`       | UUID primary key (auto-generated) |
| `@PrimaryKey()`            | Mark field as part of PK          |
| `@ScopeField()`            | Scope/tenant discriminator        |
| `@CreateDateField()`       | Auto-set on insert                |
| `@UpdateDateField()`       | Auto-set on every update          |
| `@DeleteDateField()`       | Soft-delete timestamp             |
| `@VersionField()`          | Optimistic locking counter        |
| `@VersionKeyField()`       | Temporal versioning key           |
| `@VersionStartDateField()` | Temporal version start            |
| `@VersionEndDateField()`   | Temporal version end              |
| `@ExpiryDateField()`       | TTL expiration timestamp          |

### Field Constraints

| Decorator                      | Description                            |
| ------------------------------ | -------------------------------------- |
| `@Nullable()`                  | Allow NULL values                      |
| `@Default(value)`              | Set default value                      |
| `@Generated(strategy)`         | `"uuid"`, `"increment"`, or `"string"` |
| `@Unique(options?)`            | Unique constraint                      |
| `@Index(direction?, options?)` | Database index                         |
| `@Check(expression)`           | SQL check constraint                   |
| `@Precision(n)` / `@Scale(n)`  | Numeric precision and scale            |
| `@Min(n)` / `@Max(n)`          | Numeric bounds                         |
| `@Enum(type)`                  | Restrict to enum values                |
| `@ReadOnly()`                  | Prevent updates after insert           |
| `@Comment(text)`               | Column comment                         |
| `@Transform(fn)`               | Transform on hydration/dehydration     |
| `@Computed(fn)`                | Read-only computed field               |
| `@Encrypted(options?)`         | Field-level encryption at rest         |
| `@Deferrable(initially?)`      | Deferrable FK constraint               |
| `@Hide(event)`                 | Exclude from serialization             |
| `@OrderBy(direction)`          | Default sort for relation collections  |

### Relation Decorators

| Decorator                      | Description                         |
| ------------------------------ | ----------------------------------- |
| `@OneToOne(entity, backRef)`   | One-to-one relationship             |
| `@OneToMany(entity, backRef)`  | One-to-many (inverse side)          |
| `@ManyToOne(entity, backRef)`  | Many-to-one (owning side)           |
| `@ManyToMany(entity, backRef)` | Many-to-many                        |
| `@JoinKey(mapping?)`           | Mark as owning side (has FK column) |
| `@JoinTable(options?)`         | Configure join table for M:N        |
| `@RelationId(key)`             | Expose FK value as a field          |
| `@RelationCount(key)`          | Expose relation count               |
| `@Eager()`                     | Always load with parent             |
| `@Lazy(scope?)`                | Load on first access                |
| `@Cascade(options)`            | Cascade insert/update/destroy       |
| `@OnOrphan(action)`            | Action when relation is removed     |

### Lifecycle Hooks

| Decorator                                          | Phase                          |
| -------------------------------------------------- | ------------------------------ |
| `@OnCreate(fn)`                                    | In-memory instantiation (sync) |
| `@OnValidate(fn)`                                  | Validation (sync)              |
| `@OnHydrate(fn)`                                   | Hydration from DB (sync)       |
| `@BeforeInsert(fn)` / `@AfterInsert(fn)`           | Around INSERT                  |
| `@BeforeUpdate(fn)` / `@AfterUpdate(fn)`           | Around UPDATE                  |
| `@BeforeSave(fn)` / `@AfterSave(fn)`               | Around INSERT or UPDATE        |
| `@BeforeDestroy(fn)` / `@AfterDestroy(fn)`         | Around hard DELETE             |
| `@BeforeSoftDestroy(fn)` / `@AfterSoftDestroy(fn)` | Around soft delete             |
| `@BeforeRestore(fn)` / `@AfterRestore(fn)`         | Around restore                 |
| `@AfterLoad(fn)`                                   | After loading from DB          |

## Repository API

Get a repository from the source:

```typescript
const repo = source.repository(User);
```

### Create & Insert

```typescript
// In-memory instance (not persisted)
const user = repo.create({ name: "Alice", age: 30 });

// Insert one
const saved = await repo.insert({ name: "Alice", age: 30 });

// Insert many
const users = await repo.insert([
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
]);

// Save — inserts if new, updates if exists
const result = await repo.save({ name: "Alice", age: 30 });
```

### Read

```typescript
// Find one
const user = await repo.findOne({ name: "Alice" }); // User | null
const user = await repo.findOneOrFail({ name: "Alice" }); // User (throws if not found)

// Find many
const users = await repo.find({ age: { $gte: 18 } });

// Find with options
const users = await repo.find(
  { age: { $gte: 18 } },
  {
    select: ["id", "name"],
    order: { name: "ASC" },
    limit: 10,
    offset: 20,
    relations: ["posts"],
    withDeleted: true,
  },
);

// Count and existence
const total = await repo.count({ age: { $gte: 18 } });
const exists = await repo.exists({ email: "alice@example.com" });

// Find with count
const [users, total] = await repo.findAndCount({ age: { $gte: 18 } }, { limit: 10 });

// Find or create
const user = await repo.findOneOrSave(
  { email: "alice@example.com" },
  { name: "Alice", email: "alice@example.com" },
);
```

### Update

```typescript
user.name = "Alice Smith";
const updated = await repo.update(user);

// Batch update
const updated = await repo.update([user1, user2]);

// Update many by criteria
await repo.updateMany({ age: { $lt: 18 } }, { status: "minor" });

// Increment / decrement
await repo.increment({ id: user.id }, "loginCount", 1);
await repo.decrement({ id: user.id }, "credits", 5);
```

### Delete

```typescript
// Destroy loaded entities
await repo.destroy(user);
await repo.destroy([user1, user2]);

// Delete by criteria
await repo.delete({ status: "expired" });
```

### Upsert

```typescript
const user = await repo.upsert(
  { name: "Alice", email: "alice@example.com", age: 30 },
  { conflictOn: ["email"] },
);

// Batch upsert
const users = await repo.upsert([user1, user2, user3], { conflictOn: ["email"] });
```

### Clone

```typescript
// Deep copy with a new primary key
const copy = await repo.clone(user);
```

### Aggregates

```typescript
const total = await repo.sum("age");
const avg = await repo.average("score");
const min = await repo.minimum("age");
const max = await repo.maximum("age");

// With criteria
const avgActive = await repo.average("score", { status: "active" });
```

### Pagination

```typescript
// Offset-based
const result = await repo.findPaginated(
  { status: "active" },
  {
    page: 2,
    pageSize: 20,
  },
);
// → { data, total, page, pageSize, totalPages, hasMore }

// Cursor-based (Relay-style)
const result = await repo.paginate(undefined, {
  first: 20,
  after: "cursor-string",
  orderBy: { createdAt: "DESC" },
});
// → { data, startCursor, endCursor, hasNextPage, hasPreviousPage }
```

### Streaming

```typescript
// AsyncIterable
for await (const user of repo.stream({ where: { status: "active" } })) {
  process.stdout.write(user.name + "\n");
}

// Server-side cursor with batching
const cursor = await repo.cursor({ batchSize: 100 });
try {
  let batch = await cursor.nextBatch();
  while (batch.length > 0) {
    await processBatch(batch);
    batch = await cursor.nextBatch();
  }
} finally {
  await cursor.close();
}
```

### Truncate

```typescript
await repo.clear(); // delete all rows
await repo.clear({ cascade: true, restartIdentity: true });
```

## Query Builder

For complex queries beyond what the repository methods provide:

```typescript
const qb = source.queryBuilder(User);

const users = await qb
  .where({ age: { $gte: 18 } })
  .andWhere({ status: "active" })
  .orderBy({ name: "ASC" })
  .skip(20)
  .take(10)
  .getMany();
```

### Terminal Methods

| Method              | Return Type      |
| ------------------- | ---------------- |
| `getOne()`          | `T \| null`      |
| `getOneOrFail()`    | `T`              |
| `getMany()`         | `T[]`            |
| `getManyAndCount()` | `[T[], number]`  |
| `count()`           | `number`         |
| `exists()`          | `boolean`        |
| `getRawRows()`      | `any[]`          |
| `sum(field)`        | `number \| null` |
| `average(field)`    | `number \| null` |
| `minimum(field)`    | `number \| null` |
| `maximum(field)`    | `number \| null` |

### Filtering

```typescript
qb.where({ age: { $gte: 18 } })
  .andWhere({ status: "active" })
  .orWhere({ role: "admin" })
  .getMany();
```

### Projections

```typescript
qb.select("id", "name", "email").distinct().getMany();
```

### Relations

```typescript
qb.include("posts", { required: true }).include("profile").getMany();
```

### Group By / Having

```typescript
qb.select("status")
  .groupBy("status")
  .having({ count: { $gt: 5 } })
  .getRawRows();
```

### Window Functions

```typescript
qb.window({
  fn: "ROW_NUMBER",
  partitionBy: ["department"],
  orderBy: { salary: "DESC" },
  alias: "rank",
}).getRawRows();
```

Supported functions: `ROW_NUMBER`, `RANK`, `DENSE_RANK`, `NTILE`, `LAG`, `LEAD`, `FIRST_VALUE`, `LAST_VALUE`, `SUM`, `AVG`, `MIN`, `MAX`, `COUNT`.

### Soft-Delete & Versioning

```typescript
qb.withDeleted().getMany(); // include soft-deleted rows
qb.withoutScope().getMany(); // bypass scope filtering
qb.versionAt(new Date("2024-06-01")).getMany(); // point-in-time query
qb.withAllVersions().getMany(); // all temporal versions
```

### Raw SQL (PostgreSQL, MySQL, SQLite)

```typescript
import { sql } from "@lindorm/proteus";

qb.whereRaw(sql`age > ${18} AND status = ${"active"}`)
  .selectRaw(sql`COUNT(*)`, "total")
  .getMany();
```

The `sql` tagged template produces parameterized queries — values are never interpolated into the SQL string.

### Write Operations

Query builder write operations bypass ORM lifecycle hooks (no `@BeforeInsert`, no cascade, no version check).

```typescript
// Bulk insert
const result = await qb
  .insert()
  .values([
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ])
  .returning("*")
  .execute();
// → { rows: [...], rowCount: 2 }

// Conditional update
await qb
  .update()
  .set({ status: "inactive" })
  .where({ lastLogin: { $lt: cutoffDate } })
  .execute();

// Conditional delete
await qb.delete().where({ status: "deleted" }).execute();

// Soft delete via query builder
await qb
  .softDelete()
  .where({ expiresAt: { $lt: new Date() } })
  .execute();
```

### Cloning

```typescript
const baseQuery = qb.where({ status: "active" }).orderBy({ name: "ASC" });
const page1 = await baseQuery.clone().skip(0).take(10).getMany();
const page2 = await baseQuery.clone().skip(10).take(10).getMany();
```

### Debug

```typescript
const query = qb.where({ name: "Alice" }).toQuery();
console.log(query); // driver-specific query representation
```

## Predicates

All `where` and `criteria` parameters accept a `Predicate<E>` — a type-safe query object:

```typescript
// Exact match
{ name: "Alice" }

// Comparison
{ age: { $gt: 18 } }
{ age: { $gte: 18, $lte: 65 } }
{ age: { $between: [18, 65] } }

// Equality / null checks
{ status: { $eq: "active" } }
{ status: { $neq: "banned" } }
{ email: { $eq: null } }
{ deletedAt: { $exists: false } }

// Pattern matching
{ name: { $like: "Ali%" } }
{ name: { $ilike: "%alice%" } }       // case-insensitive
{ email: { $regex: /@example\.com$/ } }

// Set membership
{ status: { $in: ["active", "pending"] } }
{ status: { $nin: ["banned", "deleted"] } }

// Array operators
{ tags: { $all: ["typescript", "orm"] } }     // contains all
{ tags: { $overlap: ["node", "deno"] } }      // contains any
{ tags: { $contained: ["a", "b", "c"] } }     // subset of
{ tags: { $length: 3 } }                      // exact length

// JSON containment
{ metadata: { $has: { role: "admin" } } }

// Modulo
{ age: { $mod: [2, 0] } }  // even ages

// Logical combinators
{ $and: [{ age: { $gte: 18 } }, { status: "active" }] }
{ $or: [{ role: "admin" }, { role: "moderator" }] }
{ $not: { status: "banned" } }
```

## Relations

### One-to-One

```typescript
@Entity()
class User {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Eager()
  @JoinKey() // owning side — stores the FK
  @OneToOne(() => Profile, "user")
  profile!: Profile | null;

  @Nullable()
  @Field("uuid")
  profileId!: string | null;
}

@Entity()
class Profile {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  bio!: string;

  @OneToOne(() => User, "profile") // inverse side — no @JoinKey
  user!: User | null;
}
```

### One-to-Many / Many-to-One

```typescript
@Entity()
class Author {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @Eager()
  @OneToMany(() => Article, "author")
  articles!: Article[];
}

@Entity()
class Article {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  title!: string;

  @ManyToOne(() => Author, "articles")
  author!: Author | null;

  authorId!: string | null; // FK populated automatically
}
```

Usage:

```typescript
const authorRepo = source.repository(Author);
const articleRepo = source.repository(Article);

// Cascade insert via parent
const author = await authorRepo.save({
  name: "Alice",
  articles: [
    articleRepo.create({ title: "First Post" }),
    articleRepo.create({ title: "Second Post" }),
  ],
});

// @Eager loads articles automatically
const found = await authorRepo.findOne({ id: author.id });
console.log(found!.articles.length); // 2
```

### Many-to-Many

```typescript
@Entity()
class Course {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @JoinTable() // owning side — creates the join table
  @ManyToMany(() => Student, "courses")
  students!: Student[];
}

@Entity()
class Student {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => Course, "students") // inverse side
  courses!: Course[];
}
```

Usage:

```typescript
const courseRepo = source.repository(Course);
const studentRepo = source.repository(Student);

const alice = await studentRepo.insert({ name: "Alice" });
const bob = await studentRepo.insert({ name: "Bob" });

const math = await courseRepo.save({
  name: "Mathematics",
  students: [alice, bob],
});

// Update the relation set
math.students = [alice]; // removes Bob
await courseRepo.save(math);
```

### Cascade Options

```typescript
@Cascade({ onInsert: "cascade", onUpdate: "cascade", onDestroy: "cascade" })
@OneToMany(() => Article, "author")
articles!: Article[];
```

### Eager vs Lazy Loading

```typescript
// Always loaded with the parent entity
@Eager()
@OneToMany(() => Article, "author")
articles!: Article[];

// Loaded on first access
@Lazy()
@OneToOne(() => Profile, "user")
profile!: LazyType<Profile | null>;

// Use relations option for ad-hoc loading
const user = await repo.findOne({ id }, { relations: ["posts"] });
```

## Transactions

```typescript
const result = await source.transaction(async (ctx) => {
  const userRepo = ctx.repository(User);
  const postRepo = ctx.repository(Post);

  const user = await userRepo.insert({ name: "Alice" });
  await postRepo.insert({ title: "Hello", authorId: user.id });

  return user;
});
// If any operation throws, the entire transaction rolls back.
```

### Isolation Levels

```typescript
await source.transaction(
  async (ctx) => {
    /* ... */
  },
  { isolation: "SERIALIZABLE" },
);
```

Supported: `"READ COMMITTED"`, `"REPEATABLE READ"`, `"SERIALIZABLE"`.

### Automatic Retry

```typescript
await source.transaction(
  async (ctx) => {
    /* ... */
  },
  {
    retry: {
      maxRetries: 3,
      initialDelayMs: 50,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
      jitter: true,
      onRetry: (attempt, error) => console.warn(`Retry ${attempt}`, error),
    },
  },
);
```

### Nested Transactions (Savepoints)

```typescript
await source.transaction(async (ctx) => {
  await ctx.repository(User).insert({ name: "Alice" });

  // Creates a savepoint — rolls back independently
  await ctx.transaction(async (inner) => {
    await inner.repository(Post).insert({ title: "Hello" });
  });
});
```

### Direct Client Access

```typescript
import type { PoolClient } from "pg";

const client = await source.client<PoolClient>();
// Use the underlying driver client directly
```

## Lifecycle Hooks

Hooks run automatically during entity operations:

```typescript
const hashPassword = async (_ctx: unknown, user: User) => {
  if (user.passwordChanged) {
    user.password = await argon2.hash(user.password);
  }
};

const setDefaults = (_ctx: unknown, user: User) => {
  user.status ??= "active";
};

@Entity()
@OnCreate(setDefaults)
@BeforeInsert(hashPassword)
@BeforeUpdate(hashPassword)
@AfterLoad(async (_ctx, user) => {
  user.fullName = `${user.firstName} ${user.lastName}`;
})
class User {
  /* ... */
}
```

### Execution Order

| Phase        | Hooks                                                                     |
| ------------ | ------------------------------------------------------------------------- |
| Construction | `@OnCreate` (sync)                                                        |
| Validation   | `@OnValidate` (sync)                                                      |
| Insert       | `@BeforeSave` → `@BeforeInsert` → persist → `@AfterInsert` → `@AfterSave` |
| Update       | `@BeforeSave` → `@BeforeUpdate` → persist → `@AfterUpdate` → `@AfterSave` |
| Destroy      | `@BeforeDestroy` → delete → `@AfterDestroy`                               |
| Soft Delete  | `@BeforeSoftDestroy` → mark → `@AfterSoftDestroy`                         |
| Restore      | `@BeforeRestore` → unmark → `@AfterRestore`                               |
| Hydration    | `@OnHydrate` (sync) → `@AfterLoad`                                        |

## Soft Deletes & Expiry

### Soft Deletes

Add `@DeleteDateField()` to enable soft deletes:

```typescript
@Entity()
class Post {
  @PrimaryKeyField()
  id!: string;

  @DeleteDateField()
  deletedAt!: Date | null;

  @Field("string")
  title!: string;
}

const repo = source.repository(Post);

// Soft delete — sets deletedAt, keeps the row
await repo.softDestroy(post);
await repo.softDelete({ status: "spam" });

// Queries automatically exclude soft-deleted rows
const active = await repo.find();

// Include soft-deleted rows
const all = await repo.find(undefined, { withDeleted: true });

// Restore
await repo.restore({ id: post.id });
```

### TTL / Expiry

```typescript
@Entity()
class Session {
  @PrimaryKeyField()
  id!: string;

  @ExpiryDateField()
  expiresAt!: Date | null;

  @Field("string")
  token!: string;
}

const repo = source.repository(Session);
const remaining = await repo.ttl({ id: session.id }); // ms until expiry
await repo.deleteExpired(); // remove all expired rows
```

MongoDB automatically creates TTL indexes for `@ExpiryDateField`.

## Temporal Versioning

Track the full history of entity changes with version keys:

```typescript
@Entity()
class Product {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField() // composite PK: (id, versionId)
  versionId!: string;

  @VersionStartDateField()
  validFrom!: Date;

  @VersionEndDateField()
  validTo!: Date | null;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;

  @Field("string")
  name!: string;

  @Field("decimal")
  price!: number;
}

const repo = source.repository(Product);

// Point-in-time query
const snapshot = await repo.find(undefined, {
  versionTimestamp: new Date("2024-06-01"),
});

// All versions of a specific entity
const history = await repo.versions({ id: product.id });
```

## Filters

Reusable, parameterized WHERE clauses at the entity level:

```typescript
@Entity()
@Filter({
  name: "tenant",
  condition: "tenantId = :tenantId",
  default: true, // enabled by default
})
@Filter({
  name: "active",
  condition: "status = 'active'",
})
class Resource {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;

  @Field("string")
  status!: string;
}

// Set filter parameters
source.setFilterParams("tenant", { tenantId: "tenant-abc" });

// Enable / disable
source.enableFilter("active");
source.disableFilter("tenant");

// Override per-query
const qb = source.queryBuilder(Resource);
qb.setFilter("tenant", { tenantId: "tenant-xyz" }).getMany();
qb.setFilter("active", false).getMany(); // disable for this query
```

## Caching

Enable query-level caching with a pluggable adapter:

```typescript
import { MemoryCacheAdapter, RedisCacheAdapter } from "@lindorm/proteus";

// In-memory cache (single process)
new ProteusSource({
  driver: "postgres",
  cache: {
    adapter: new MemoryCacheAdapter({ maxEntries: 5000 }),
    ttl: "5m",
  },
  // ...
});

// Redis cache (distributed)
new ProteusSource({
  driver: "postgres",
  cache: {
    adapter: new RedisCacheAdapter({ host: "localhost", port: 6379 }),
    ttl: "10m",
  },
  // ...
});
```

### Per-Entity Default TTL

```typescript
@Cache("30s")
@Entity()
class Config {
  /* ... */
}
```

### Per-Query Override

```typescript
const users = await repo.find({ status: "active" }, { cache: { ttl: "1m" } });
const fresh = await repo.find({ status: "active" }, { cache: false }); // skip cache
```

## Field-Level Encryption

Transparently encrypt sensitive fields at rest:

```typescript
@Entity()
class Patient {
  @PrimaryKeyField()
  id!: string;

  @Encrypted()
  @Field("string")
  ssn!: string;

  @Encrypted()
  @Field("json")
  medicalRecord!: Record<string, unknown>;
}

new ProteusSource({
  driver: "postgres",
  amphora, // IAmphora key store instance
  entities: [Patient],
  logger,
});
```

Values are encrypted before writing and decrypted after reading.

## Naming Strategies

Control how TypeScript field names map to database column names:

```typescript
new ProteusSource({
  driver: "postgres",
  naming: "snake", // camelCase → snake_case
  // ...
});
```

| Strategy           | Field Name   | Column Name  |
| ------------------ | ------------ | ------------ |
| `"none"` (default) | `firstName`  | `firstName`  |
| `"snake"`          | `firstName`  | `first_name` |
| `"camel"`          | `first_name` | `firstName`  |

Applies to column names, join keys, and find keys.

## Entity Subscribers

Cross-entity lifecycle observers for auditing, logging, or side effects:

```typescript
import type { IEntitySubscriber, InsertEvent, UpdateEvent } from "@lindorm/proteus";

const auditSubscriber: IEntitySubscriber = {
  listenTo: () => [User, Post], // omit to listen to all entities

  afterInsert: async (event: InsertEvent<any>) => {
    await auditLog.write("insert", event.entity);
  },
  afterUpdate: async (event: UpdateEvent<any>) => {
    await auditLog.write("update", event.entity);
  },
};

source.addSubscriber(auditSubscriber);
```

Available events: `beforeInsert`, `afterInsert`, `beforeUpdate`, `afterUpdate`, `beforeDestroy`, `afterDestroy`, `beforeSoftDestroy`, `afterSoftDestroy`, `beforeRestore`, `afterRestore`, `afterLoad`.

## Per-Request Isolation

Clone the source for request-scoped logging and filter state:

```typescript
app.use(async (ctx, next) => {
  ctx.db = source.clone({ logger: ctx.logger });
  ctx.db.setFilterParams("tenant", { tenantId: ctx.state.tenantId });
  ctx.db.enableFilter("tenant");
  await next();
});

router.get("/users", async (ctx) => {
  // Isolated filter state + traced logging per request
  const { page = 1, pageSize = 20 } = ctx.query;
  ctx.body = await ctx.db.repository(User).findPaginated(undefined, {
    page: Number(page),
    pageSize: Number(pageSize),
    order: { createdAt: "DESC" },
  });
  // → { data, total, page, pageSize, totalPages, hasMore }
});
```

Clones share the underlying connection pool — lightweight and safe to create per request.

## Schema Synchronization & Migrations

### Auto Synchronization (Development)

```typescript
new ProteusSource({
  driver: "postgres",
  synchronize: true, // apply DDL changes on setup()
  // synchronize: "dry-run", // log planned DDL without executing
  // ...
});

await source.setup(); // creates/alters tables, indexes, constraints
```

### Migrations (Production)

```typescript
new ProteusSource({
  driver: "postgres",
  migrations: ["./migrations/*.ts"],
  migrationsTable: "proteus_migrations",
  runMigrations: true,
  // ...
});
```

## CLI

Proteus includes a CLI for migration management and database diagnostics.

### Migration Commands

```bash
# Generate a migration from schema diff
proteus migrate generate --name add-users-table
proteus migrate generate --interactive  # interactive mode with entity select + preview

# Create a blank migration stub
proteus migrate create --name custom-data-migration

# Generate a baseline migration (full schema snapshot)
proteus migrate baseline --name initial

# Apply all pending migrations
proteus migrate run

# Roll back the last N migrations
proteus migrate rollback --count 2

# View migration status
proteus migrate status

# Manually resolve migration state
proteus migrate resolve --applied 20240101_add_users
proteus migrate resolve --rolled-back 20240101_add_users
```

### Database Commands

```bash
# Verify database connectivity
proteus db ping
```

### Global Options

| Flag                  | Description                                                 |
| --------------------- | ----------------------------------------------------------- |
| `-s, --source <path>` | Path to source config file (default: `./proteus.config.ts`) |
| `-e, --export <name>` | Named export from the config file                           |
| `-v, --verbose`       | Debug-level logging                                         |

## Errors

Proteus provides typed error classes for precise error handling:

| Error                      | When                              |
| -------------------------- | --------------------------------- |
| `DuplicateKeyError`        | Unique constraint violation       |
| `OptimisticLockError`      | Version mismatch on update        |
| `ForeignKeyViolationError` | FK constraint violation           |
| `NotNullViolationError`    | NULL in a non-nullable column     |
| `CheckConstraintError`     | Check constraint violation        |
| `DeadlockError`            | Transaction deadlock detected     |
| `SerializationError`       | Serializable isolation conflict   |
| `TransactionError`         | Transaction lifecycle error       |
| `MigrationError`           | Migration execution failure       |
| `SyncError`                | Schema synchronization failure    |
| `DriverError`              | Low-level driver error            |
| `NotSupportedError`        | Operation not supported by driver |
| `ProteusRepositoryError`   | General repository error          |

```typescript
import { DuplicateKeyError, OptimisticLockError } from "@lindorm/proteus";

try {
  await repo.insert({ email: "alice@example.com" });
} catch (error) {
  if (error instanceof DuplicateKeyError) {
    // handle unique constraint violation
  }
  if (error instanceof OptimisticLockError) {
    // handle stale entity — reload and retry
  }
  throw error;
}
```

## License

AGPL-3.0-or-later
