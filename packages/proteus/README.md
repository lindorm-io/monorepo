# @lindorm/proteus

A multi-driver ORM for TypeScript built on TC39 (Stage 3) decorators. Define your entities once and run them against PostgreSQL, MySQL, SQLite, MongoDB, Redis, or an in-memory store with zero code changes.

This package is **ESM-only**. All examples use `import` syntax — `require` is not supported.

## Installation

```bash
npm install @lindorm/proteus
```

Peer dependencies are driver-specific. Install only the ones you need:

| Driver     | Peer dependency          |
| ---------- | ------------------------ |
| PostgreSQL | `pg` >= 8.18             |
| MySQL      | `mysql2` >= 3.19         |
| SQLite     | `better-sqlite3` >= 12.6 |
| MongoDB    | `mongodb` >= 6.17        |
| Redis      | `ioredis` >= 5.10        |
| In-Memory  | none                     |

Two further peer dependencies are optional and only needed for specific features:

| Peer               | Required for                                     |
| ------------------ | ------------------------------------------------ |
| `@lindorm/amphora` | `@Encrypted` field-level encryption              |
| `@lindorm/logger`  | `ILogger` instance — required on `ProteusSource` |

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

const source = new ProteusSource({
  driver: "postgres",
  host: "localhost",
  port: 5432,
  database: "myapp",
  user: "postgres",
  password: "secret",
  entities: [User],
  synchronize: true,
  logger,
});

await source.connect();
await source.setup();

const repo = source.repository(User);

const user = await repo.insert({ name: "Alice", email: "alice@example.com", age: 30 });
const found = await repo.findOne({ name: "Alice" });
user.age = 31;
await repo.update(user);
await repo.destroy(user);

await source.disconnect();
```

## Subpath exports

| Export                          | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `@lindorm/proteus`              | Main runtime API: ProteusSource, decorators, types |
| `@lindorm/proteus/mocks/jest`   | Jest mock factories for tests                      |
| `@lindorm/proteus/mocks/vitest` | Vitest mock factories for tests                    |

The package also ships a `proteus` binary for migration management and database diagnostics — see the [CLI](#cli) section.

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
- [Lifecycle Events](#lifecycle-events)
- [Soft Deletes & Expiry](#soft-deletes--expiry)
- [Temporal Versioning](#temporal-versioning)
- [Filters](#filters)
- [Caching](#caching)
- [Field-Level Encryption](#field-level-encryption)
- [Naming Strategies](#naming-strategies)
- [Per-Request Isolation](#per-request-isolation)
- [Schema Synchronization & Migrations](#schema-synchronization--migrations)
- [CLI](#cli)
- [Errors](#errors)
- [Test Mocks](#test-mocks)
- [License](#license)

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

Full ACID transactions with savepoints. Connection pooling via `mysql2`.

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

SAVEPOINT-based nested transactions. Powered by `better-sqlite3`.

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

Key-value storage using `ioredis`. No multi-statement transactions — operations execute without atomicity. Best suited for caching entities or session-like data.

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

| Option      | Type                           | Description                                           |
| ----------- | ------------------------------ | ----------------------------------------------------- |
| `entities`  | `Array<Constructor \| string>` | Entity classes or glob patterns                       |
| `namespace` | `string`                       | Schema (SQL), database (Mongo), key prefix (Redis)    |
| `naming`    | `"snake" \| "camel" \| "none"` | Column name strategy (default: `"none"`)              |
| `cache`     | `{ adapter, ttl? }`            | Query caching configuration                           |
| `amphora`   | `IAmphora`                     | Key store for `@Encrypted` fields                     |
| `meta`      | `ProteusHookMeta`              | Default request-scoped hook metadata                  |
| `breaker`   | `boolean \| BreakerOptions`    | Circuit breaker for network drivers (default enabled) |
| `logger`    | `ILogger`                      | **Required.** Logger instance                         |

SQL drivers, MongoDB, and SQLite also accept schema management options:

| Option            | Type                   | Description                         |
| ----------------- | ---------------------- | ----------------------------------- |
| `synchronize`     | `boolean \| "dry-run"` | Auto-sync schema on setup           |
| `migrations`      | `Array<string>`        | Glob patterns for migration files   |
| `migrationsTable` | `string`               | Custom migrations ledger table name |
| `runMigrations`   | `boolean`              | Run pending migrations on setup     |

The circuit breaker is automatically disabled for the `memory` and `sqlite` drivers (no network I/O).

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
| Integer        | `bigint`, `integer`, `smallint`                                       |
| Floating Point | `decimal`, `float`, `real`                                            |
| String         | `enum`, `string`, `text`, `uuid`, `varchar`                           |
| Logical        | `email`, `url`                                                        |
| Date/Time      | `date`, `interval`, `time`, `timestamp`                               |
| Binary         | `binary`                                                              |
| Structured     | `array`, `json`, `object`                                             |
| Network        | `cidr`, `inet`, `macaddr`                                             |
| Geometric      | `box`, `circle`, `line`, `lseg`, `path`, `point`, `polygon`, `vector` |
| XML            | `xml`                                                                 |

### Examples

```typescript
@Field("json")
metadata!: Record<string, unknown>;

@Field("array", { arrayType: "string" })
tags!: string[];

@Field("decimal")
@Precision(10, 2)
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

All decorators use the TC39 (Stage 3) decorator specification. Class decorators receive `ClassDecoratorContext`, field decorators receive `ClassFieldDecoratorContext`. Metadata flows through the `Symbol.metadata` prototype chain, so abstract base class decorators are inherited by concrete subclasses. The runtime polyfills `Symbol.metadata` automatically when not present.

### Entity & Class-Level Decorators

#### `@Entity`

Marks a class as a persistent entity.

```typescript
@Entity()
class User {
  /* ... */
}

@Entity({ name: "app_users" }) // custom table name
class User {
  /* ... */
}
```

**Options:** `{ name?: string }` — Override the table/collection name. Defaults to the class name. Must match `/^[a-zA-Z_][a-zA-Z0-9_]*$/`.

#### `@AbstractEntity`

Marks a class as a mapped superclass. It is **not** registered as a concrete table. Fields, hooks, and metadata are inherited by `@Entity()` subclasses via the `Symbol.metadata` prototype chain.

```typescript
@AbstractEntity()
class BaseEntity {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @UpdateDateField()
  updatedAt!: Date;
}

@Entity()
class User extends BaseEntity {
  @Field("string")
  name!: string;
}
```

#### `@Embeddable`

Marks a class as an embeddable value type with no primary key, table, or independent identity. Fields are flattened into the parent entity's table via `@Embedded()`.

#### `@Namespace`

Places the entity in a specific namespace — mapped to schema (SQL), database (MongoDB), or key prefix (Redis).

```typescript
@Namespace("billing")
@Entity()
class Invoice {
  /* ... */
}
```

#### `@Schema`

Attaches a Zod schema for runtime validation. Evaluated automatically before every insert/update and manually via `repository.validate()`.

```typescript
import { z } from "zod";

@Schema(z.object({ name: z.string().min(1), email: z.string().email() }))
@Entity()
class User {
  /* ... */
}
```

#### `@Inheritance`

Declares the entity as the root of an inheritance hierarchy.

```typescript
@Entity()
@Inheritance("single-table") // all subtypes in one table
@Discriminator("type")
class Vehicle {
  /* ... */
}

@Entity()
@Inheritance("joined") // separate table per subtype, joined by FK
@Discriminator("type")
class Vehicle {
  /* ... */
}
```

**Argument:** `"single-table"` (default) or `"joined"`.

#### `@Discriminator`

Specifies which property serves as the discriminator column for table inheritance. Applied on the inheritance root class. The field name is compile-time checked against the decorated class.

#### `@DiscriminatorValue`

Specifies the discriminator value for a concrete subclass.

```typescript
@Entity()
@DiscriminatorValue("car")
class Car extends Vehicle {
  /* ... */
}
```

**Argument:** `string | number`.

#### `@DefaultOrder`

Sets the default sort order for queries against this entity. Applied when `FindOptions.order` is not provided. Explicit `order` in `FindOptions` or `.orderBy()` on the query builder takes precedence.

```typescript
@DefaultOrder({ createdAt: "DESC" })
@Entity()
class Post {
  /* ... */
}
```

**Argument:** `Record<string, "ASC" | "DESC">`.

#### `@Cache`

Enables query-level caching for the entity. Requires a cache adapter configured on `ProteusSource`. Per-query caching can be overridden via `FindOptions.cache`.

```typescript
@Cache() // use source-level default TTL
@Entity()
class Config {
  /* ... */
}

@Cache("30s") // entity-specific TTL
@Entity()
class Session {
  /* ... */
}
```

**Argument:** `ReadableTime?` — e.g. `"5m"`, `"1h"`, `"30s"`. Defaults to the source-level TTL.

#### `@AppendOnly`

Marks an entity as append-only. Insert and read operations are allowed; update, delete, and truncate are blocked at both the application layer (repository guards) and the database layer (SQL triggers).

**Allowed:** `insert`, `clone`, `find*`, `count`, `exists`, `aggregate`, `cursor`, `paginate`.

**Blocked:** `update`, `destroy`, `softDestroy`, `updateMany`, `softDelete`, `delete`, `upsert`, `clear`, `restore`.

For SQL drivers (PostgreSQL, MySQL, SQLite), `setup()` generates `BEFORE UPDATE` / `BEFORE DELETE` triggers that enforce immutability at the database level. PostgreSQL additionally generates a `BEFORE TRUNCATE` trigger.

#### `@Filter`

Declares a parameterized WHERE-clause filter on the entity. Filters are named, reusable predicates that can be enabled/disabled per-source or per-query. Use `"$paramName"` placeholders for runtime-supplied values.

```typescript
@Entity()
@Filter({ name: "active", condition: { deletedAt: null }, default: true })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class Resource {
  /* ... */
}

source.setFilterParams("tenant", { tenantId: "tenant-abc" });
source.enableFilter("active");
```

| Field       | Type              | Description                                   |
| ----------- | ----------------- | --------------------------------------------- |
| `name`      | `string`          | Unique filter name                            |
| `condition` | `Predicate<Dict>` | Filter condition using Predicate operators    |
| `default`   | `boolean`         | Auto-enable on every query (default: `false`) |

#### `@Check` (class-level)

Declares a CHECK constraint using a raw SQL boolean expression.

```typescript
@Check("price >= 0")
@Check("start_date < end_date", { name: "chk_date_range" })
@Entity()
class Product {
  /* ... */
}
```

**Arguments:** `(expression: string, options?: { name?: string })`.

#### `@Index` (class-level)

Declares a composite database index across multiple fields.

```typescript
@Index<typeof User>(["lastName", "firstName"])
@Entity()
class User {
  /* ... */
}

@Index<typeof User>({ lastName: "asc", firstName: "asc", createdAt: "desc" })
@Entity()
class User {
  /* ... */
}

@Index<typeof User>(["email"], { unique: true, where: "deleted_at IS NULL" })
@Entity()
class User {
  /* ... */
}
```

| Field        | Type      | Description                           |
| ------------ | --------- | ------------------------------------- |
| `unique`     | `boolean` | Create a unique index                 |
| `concurrent` | `boolean` | Build index concurrently (Postgres)   |
| `sparse`     | `boolean` | Sparse index (MongoDB)                |
| `where`      | `string`  | Partial index SQL condition           |
| `using`      | `string`  | Index method (e.g. `"gin"`, `"gist"`) |
| `with`       | `string`  | Storage parameters                    |
| `name`       | `string`  | Custom index name                     |

#### `@Unique` (class-level)

Declares a composite unique constraint across multiple fields.

```typescript
@Unique<typeof User>(["email", "tenantId"], { name: "uq_tenant_email" })
@Entity()
class User {
  /* ... */
}
```

#### `@PrimaryKey` (class-level)

Defines a composite primary key across multiple fields.

```typescript
@PrimaryKey<typeof OrderItem>(["orderId", "productId"])
@Entity()
class OrderItem {
  /* ... */
}
```

### Field Decorators

#### `@Field`

Declares a persistent column with an explicit type.

```typescript
@Field("string")
name!: string;

@Field("string", { name: "full_name" }) // custom column name
name!: string;

@Field("array", { arrayType: "string" })
tags!: string[];
```

**Arguments:** `(type: MetaFieldType, options?: { name?: string, arrayType?: MetaFieldType })`.

#### `@PrimaryKeyField`

Shorthand combining `@Field`, `@PrimaryKey`, and `@Generated`.

```typescript
@PrimaryKeyField()                      // UUID primary key (default)
id!: string;

@PrimaryKeyField("integer")             // auto-increment integer PK
id!: number;

@PrimaryKeyField("string")              // random string PK
id!: string;

@PrimaryKeyField("uuid", { name: "pk" }) // custom column name
id!: string;
```

**Arguments:** `(type?: "uuid" | "integer" | "string", options?: { name?: string })`. Defaults to `"uuid"`. The field is automatically marked read-only and auto-generated.

#### `@PrimaryKey` (field-level)

Marks a single field as part of the primary key. Use this instead of `@PrimaryKeyField` when you need to control field type, generation strategy, or other modifiers separately.

```typescript
@PrimaryKey()
@Field("integer")
@Generated("increment")
id!: number;
```

#### `@ScopeField`

Declares a scope field for multi-tenancy or logical partitioning. Scope fields are read-only, non-nullable strings with a minimum length of 1.

```typescript
@ScopeField()
tenantId!: string;

@ScopeField({ order: 0 }) // explicit ordering for key composition
region!: string;

@ScopeField({ name: "tenant_id", order: 1 })
tenantId!: string;
```

Scope fields serve two purposes:

1. **Driver-level key composition** — in Redis and key-value drivers, scope fields determine the key prefix structure. The `order` option controls ordering (lowest first, alphabetical fallback).
2. **Automatic query filtering** — scope fields are auto-registered as a `__scope` system filter. Queries are scoped by default. Bypass with `{ withoutScope: true }` in `FindOptions`.

#### `@CreateDateField`

Timestamp field set automatically to the current time on insert. Read-only and immutable after creation.

```typescript
@CreateDateField()
createdAt!: Date;
```

#### `@UpdateDateField`

Timestamp field set automatically on every update. Read-only.

#### `@DeleteDateField`

Nullable timestamp field for soft-delete tracking. When non-null, the entity is considered soft-deleted and excluded from queries by default.

```typescript
@DeleteDateField()
deletedAt!: Date | null;
```

Use `{ withDeleted: true }` in `FindOptions` to include soft-deleted rows.

#### `@VersionField`

Integer field for optimistic locking. Automatically incremented on every update. The ORM checks the version matches before applying updates and throws `OptimisticLockError` on conflict. Read-only and non-nullable.

#### `@VersionKeyField`

Shorthand combining `@Field`, `@PrimaryKey`, `@VersionKey`, and `@Generated` for temporal tables. Part of the composite primary key alongside the regular primary key.

```typescript
@VersionKeyField()          // UUID version key (default)
versionId!: string;

@VersionKeyField("integer") // auto-increment version key
versionId!: number;
```

#### `@VersionKey`

Marks a field as a version key. Can be used at field level or class level for composite version keys.

```typescript
@VersionKey()
@Field("uuid")
@Generated("uuid")
versionId!: string;

@VersionKey<typeof Product>(["versionId", "locale"])
@Entity()
class Product { /* ... */ }
```

#### `@VersionStartDateField`

Start timestamp for temporal tables. Set on insert and when a new version is created. Read-only, non-nullable, auto-generated.

#### `@VersionEndDateField`

End timestamp for temporal tables. Nullable — `null` means the version is the current active version. Set automatically when a new version supersedes an existing one.

#### `@ExpiryDateField`

Nullable timestamp field for TTL-based expiry. Use `repository.deleteExpired()` to purge expired entities and `repository.ttl()` to check remaining time. MongoDB automatically creates TTL indexes for `@ExpiryDateField`.

### Field Modifiers

Stack these on the same property as `@Field` (or one of the shorthand field decorators).

#### `@Nullable`

Marks a field as nullable. Affects both DDL generation and Zod validation.

```typescript
@Nullable()
@Field("string")
email!: string | null;
```

#### `@Default`

Sets a default value for a field, applied when creating new entities. Accepts a literal or a function returning the default at creation time.

```typescript
@Default(0)
@Field("integer")
loginCount!: number;

@Default(() => new Date())
@Field("timestamp")
startedAt!: Date;
```

#### `@Generated`

Marks a field as auto-generated by the ORM or database.

| Strategy      | Description                              |
| ------------- | ---------------------------------------- |
| `"uuid"`      | Generate UUID v4 on insert               |
| `"increment"` | Database auto-increment sequence         |
| `"string"`    | Random string with configurable `length` |
| `"date"`      | Current timestamp                        |

```typescript
@Generated("uuid")
@Generated("string", { length: 12 })
@Generated("date")
```

**Options:** `{ length?: number, max?: number, min?: number }`.

#### `@ReadOnly`

Excludes the field from UPDATE statements after initial insert. Value is still set during entity creation.

#### `@Enum`

Restricts a field to a fixed set of allowed values. Pass a TypeScript enum or a plain `Record<string, string | number>`. Enforced during Zod validation and mapped to a CHECK constraint or native ENUM type depending on driver.

```typescript
enum Status { Active = "active", Inactive = "inactive", Banned = "banned" }

@Enum(Status)
@Field("enum")
status!: Status;
```

#### `@Precision`

Sets precision and scale for numeric fields (decimal, float, real).

```typescript
@Precision(10, 2)  // 10 significant digits, 2 decimal places → NUMERIC(10, 2)
@Field("decimal")
price!: number;
```

**Arguments:** `(precision: number, scale?: number)`. Scale defaults to `0`.

#### `@Min` / `@Max`

Set minimum/maximum bounds for numeric fields, or minimum/maximum length for string fields. Enforced during Zod validation.

```typescript
@Min(0)
@Max(150)
@Field("integer")
age!: number;
```

#### `@Comment`

Attaches a DDL comment to a column (e.g. PostgreSQL `COMMENT ON COLUMN`).

#### `@Computed`

Marks a field as a computed/generated column with a SQL expression. Computed fields are excluded from INSERT/UPDATE statements and Zod validation.

```typescript
@Computed("first_name || ' ' || last_name")
@Field("string")
fullName!: string;
```

#### `@Transform`

Applies a bidirectional transform. `to` runs during dehydration (entity → database), `from` during hydration (database → entity).

```typescript
@Transform({
  to: (value: string[]) => value.join(","),
  from: (raw: string) => raw.split(","),
})
@Field("string")
tags!: string[];
```

#### `@Encrypted`

Marks a field for application-level encryption at rest. Values are encrypted before writing and decrypted after reading. Requires an `IAmphora` key store configured on `ProteusSource`.

```typescript
@Encrypted()
@Field("string")
ssn!: string;

@Encrypted({ purpose: "pii", ownerId: "userId" })
@Field("json")
medicalRecord!: Record<string, unknown>;
```

**Options:** `{ id?, algorithm?, encryption?, purpose?, type?, ownerId? }`.

#### `@Hide`

Excludes a field from query results for a given scope. The field still exists in the database and entity; it is just excluded from SELECT projections.

```typescript
@Hide()           // hidden from both findOne and find
@Hide("single")   // hidden only from findOne
@Hide("multiple") // hidden only from find (list queries)
```

#### `@Unique` (field-level)

Single-field unique constraint.

```typescript
@Unique({ name: "uq_email" })
@Field("string")
email!: string;
```

#### `@Index` (field-level)

Single-field index.

```typescript
@Index()                            // ascending (default)
@Index("desc")                      // descending
@Index({ unique: true })            // unique
@Index({ where: "active = true" })  // partial
@Index({ using: "gin" })            // custom method
```

### Relation Decorators

Each relation has an **owning side** (stores the FK or join table reference) and an **inverse side**.

#### `@OneToOne`

```typescript
@Entity()
class User {
  @JoinKey() // owning side — stores the FK
  @OneToOne(() => Profile, "user")
  profile!: Profile | null;
}

@Entity()
class Profile {
  @OneToOne(() => User, "profile") // inverse side
  user!: User | null;
}
```

**Arguments:** `(entityFn: () => Constructor<F>, entityKey: keyof F, options?: { strategy?: RelationStrategy })`.

#### `@OneToMany`

Inverse side. The related entity's `@ManyToOne` side owns the join key.

```typescript
@OneToMany(() => Article, "author")
articles!: Article[];
```

#### `@ManyToOne`

Owning side. This entity's table gets the FK column(s).

```typescript
@ManyToOne(() => Author, "articles")
author!: Author | null;
```

#### `@ManyToMany`

Many-to-many via a join table. Use `@JoinTable()` on the owning side.

```typescript
@JoinTable() // owning side
@ManyToMany(() => Student, "courses")
students!: Student[];
```

#### `@Embedded`

Embeds an `@Embeddable()` class as flat columns in the parent table.

```typescript
@Embedded(() => Address)                      // prefix: "homeAddress_"
homeAddress!: Address | null;

@Embedded(() => Address, { prefix: "work_" }) // custom prefix
workAddress!: Address | null;
```

#### `@EmbeddedList`

Stores an array of primitives or embeddables in a separate owned collection table. The collection has no PK and no independent lifecycle — deleting the parent cascades to collection rows.

```typescript
@EmbeddedList(() => Address)                          // array of embeddables
addresses!: Address[];

@EmbeddedList("string")                               // array of primitives
tags!: string[];

@EmbeddedList("string", { tableName: "user_tags" })   // custom table name
tags!: string[];
```

##### Loading: lazy by default on `find()`, eager by default on `findOne()`

`@EmbeddedList` fields obey the same `@Eager` / `@Lazy` decorators as relations, with the JPA `@ElementCollection` default: **`{ single: "eager", multiple: "lazy" }`**.

- `repo.findOne(...)` returns plain arrays for every embedded list field.
- `repo.find(...)` returns a `LazyCollection<T>` thenable on each embedded list field. `await row.tags` resolves to the actual array and replaces the property by identity, so subsequent reads are plain arrays.

Override per scope when the default does not fit:

```typescript
@Eager()           // both findOne and find load eagerly
@EmbeddedList("string")
operations!: string[];

@Lazy("single")    // force lazy thenable on findOne
@EmbeddedList("string")
auditLog!: string[];
```

Cursor APIs (`cursor()`, `stream()`) follow the `"multiple"` scope.

#### `@JoinKey`

Marks a relation field as the owning side and optionally provides explicit join key mapping.

```typescript
@JoinKey()                             // auto-detect FK columns
@OneToOne(() => Profile, "user")
profile!: Profile | null;

@JoinKey({ authorId: "id" })           // explicit: localCol → foreignCol
@ManyToOne(() => Author, "articles")
author!: Author | null;
```

#### `@JoinTable`

Configures the join table for a `@ManyToMany` relation. Place on the owning side only.

```typescript
@JoinTable({ name: "post_tags" })
@ManyToMany(() => Tag, "posts")
tags!: Tag[];
```

#### `@RelationId`

Exposes a relation's FK value as a read-only property on the entity.

```typescript
@RelationId("author")                          // auto-detect FK column
authorId!: string;

@RelationId("author", { column: "author_id" })
authorId!: string;
```

For `*ToOne` owning relations, the FK column is auto-detected. For composite FK or `*ToMany`, specify the `column` option. Multiple `@RelationId` decorators may target the same relation for composite keys.

#### `@RelationCount`

Populates a field with the count of a related collection, loaded via a batched `COUNT(*) ... GROUP BY` query.

```typescript
@OneToMany(() => Comment, "blog")
comments!: Comment[];

@RelationCount<Blog>("comments")
@Field("integer")
commentCount!: number;
```

The field must also have `@Field("integer")`.

### Relation Modifiers

#### `@Cascade`

Configures cascade behavior on inserts, updates, and deletes.

```typescript
@Cascade({ onInsert: "cascade", onUpdate: "cascade", onDestroy: "cascade" })
@OneToMany(() => Article, "author")
articles!: Article[];
```

| Field           | Values                  | Description                                   |
| --------------- | ----------------------- | --------------------------------------------- |
| `onInsert`      | `"cascade"`             | Auto-insert related entities with parent      |
| `onUpdate`      | `"cascade"`             | Auto-update related entities with parent      |
| `onDestroy`     | `"cascade"` \| `"soft"` | Delete or soft-delete related on hard delete  |
| `onSoftDestroy` | `"cascade"` \| `"soft"` | Cascade or soft-delete related on soft delete |

#### `@Eager`

Automatically loads a relation alongside every query result.

```typescript
@Eager()           // both findOne and find
@Eager("single")   // only findOne
@Eager("multiple") // only find
```

#### `@Lazy`

Loads a relation lazily — the property returns a `PromiseLike<T>` that resolves on first access. Use `LazyType<T>` as the property type.

```typescript
@Lazy()
@OneToOne(() => Profile, "user")
profile!: LazyType<Profile | null>;
```

#### `@OnOrphan`

Configures what happens to related entities removed from a collection.

```typescript
@OnOrphan("destroy")       // permanently delete orphaned entities
@OnOrphan("soft-destroy")  // soft-delete orphaned entities
@OnOrphan("nullify")       // set the FK to null
@OnOrphan("ignore")        // do nothing (default)
```

#### `@Deferrable`

Marks a relation's FK constraint as `DEFERRABLE`, allowing constraint checks to be deferred until transaction end.

```typescript
@Deferrable()                    // DEFERRABLE INITIALLY IMMEDIATE
@Deferrable({ initially: true }) // DEFERRABLE INITIALLY DEFERRED
```

#### `@OrderBy`

Default ordering for a relation's loaded results. Applied as `ORDER BY` in SQL queries and as in-memory sorting during hydration.

```typescript
@OrderBy({ createdAt: "DESC" })
@OneToMany(() => Comment, "post")
comments!: Comment[];
```

### Lifecycle Hook Decorators

Lifecycle hooks are class decorators that register callbacks at specific points in the entity lifecycle. All hooks receive `(entity, meta)` where `meta` is a `ProteusHookMeta` carrying request-scoped metadata (`correlationId`, `actor`, `timestamp`).

**Async hooks** (`HookCallback<T>`) may return `void | Promise<void>`.
**Sync hooks** (`SyncHookCallback<T>`) must return `void` — they cannot be async.

#### `@OnCreate`

Fires synchronously when `repository.create()` builds a new entity instance. **Must be synchronous.**

```typescript
@OnCreate((user) => {
  user.slug = user.name.toLowerCase().replace(/\s+/g, "-");
})
@Entity()
class User {
  /* ... */
}
```

#### `@OnValidate`

Fires synchronously during `repository.validate()`, after the built-in Zod schema check. Throw to reject. **Must be synchronous.**

#### `@OnHydrate`

Fires synchronously when an entity is hydrated from database results, after all fields and FK columns are populated but before the entity is returned. **Must be synchronous.** For async post-load enrichment, use `@AfterLoad`.

#### `@BeforeInsert` / `@AfterInsert`

Fire around INSERT operations. `@BeforeInsert` runs after validation but before the INSERT. Both may be async.

#### `@BeforeUpdate` / `@AfterUpdate`

Fire around UPDATE operations. `@BeforeUpdate` runs after validation and version check. Both may be async.

#### `@BeforeSave` / `@AfterSave`

Fire around both INSERT and UPDATE. `@BeforeSave` runs before `@BeforeInsert`/`@BeforeUpdate`. Both may be async.

#### `@BeforeDestroy` / `@AfterDestroy`

Fire around hard DELETE. `@BeforeDestroy` runs before cascade deletes and the DELETE statement. Both may be async.

#### `@BeforeSoftDestroy` / `@AfterSoftDestroy`

Fire around soft-delete. `@BeforeSoftDestroy` runs before the delete date is set. Both may be async.

#### `@BeforeRestore` / `@AfterRestore`

Fire around restore (un-soft-delete). Both may be async.

#### `@AfterLoad`

Fires after an entity is loaded from the database, after hydration and relation loading. May be async.

### Hook Execution Order

| Phase        | Hooks (in order)                                                          |
| ------------ | ------------------------------------------------------------------------- |
| Construction | `@OnCreate` (sync)                                                        |
| Validation   | `@OnValidate` (sync)                                                      |
| Insert       | `@BeforeSave` → `@BeforeInsert` → persist → `@AfterInsert` → `@AfterSave` |
| Update       | `@BeforeSave` → `@BeforeUpdate` → persist → `@AfterUpdate` → `@AfterSave` |
| Destroy      | `@BeforeDestroy` → delete → `@AfterDestroy`                               |
| Soft Delete  | `@BeforeSoftDestroy` → mark → `@AfterSoftDestroy`                         |
| Restore      | `@BeforeRestore` → unmark → `@AfterRestore`                               |
| Hydration    | `@OnHydrate` (sync) → `@AfterLoad`                                        |

## Repository API

Get a repository from the source:

```typescript
const repo = source.repository(User);
```

### Create & Insert

```typescript
const user = repo.create({ name: "Alice", age: 30 }); // in-memory only
const saved = await repo.insert({ name: "Alice", age: 30 }); // single insert
const users = await repo.insert([
  { name: "Bob", age: 25 },
  { name: "Charlie", age: 35 },
]);
const result = await repo.save({ name: "Alice", age: 30 }); // upsert by PK
```

### Read

```typescript
const user = await repo.findOne({ name: "Alice" }); // User | null
const user = await repo.findOneOrFail({ name: "Alice" }); // throws if missing
const users = await repo.find({ age: { $gte: 18 } });

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

const total = await repo.count({ age: { $gte: 18 } });
const exists = await repo.exists({ email: "alice@example.com" });
const [users, totalCount] = await repo.findAndCount({ age: { $gte: 18 } }, { limit: 10 });

const user = await repo.findOneOrSave(
  { email: "alice@example.com" },
  { name: "Alice", email: "alice@example.com" },
);
```

### Update

```typescript
user.name = "Alice Smith";
const updated = await repo.update(user);
const updated = await repo.update([user1, user2]);

await repo.updateMany({ age: { $lt: 18 } }, { status: "minor" });

await repo.increment({ id: user.id }, "loginCount", 1);
await repo.decrement({ id: user.id }, "credits", 5);
```

### Delete

```typescript
await repo.destroy(user); // single
await repo.destroy([user1, user2]); // batch
await repo.delete({ status: "expired" }); // criteria-based
```

### Upsert

```typescript
const user = await repo.upsert(
  { name: "Alice", email: "alice@example.com", age: 30 },
  { conflictOn: ["email"] },
);

const users = await repo.upsert([user1, user2, user3], { conflictOn: ["email"] });
```

### Clone

```typescript
const copy = await repo.clone(user); // deep copy with new primary key
```

### Aggregates

```typescript
const total = await repo.sum("age");
const avg = await repo.average("score", { status: "active" });
const min = await repo.minimum("age");
const max = await repo.maximum("age");
```

### Pagination

```typescript
// Offset/page-based
const result = await repo.findPaginated({ status: "active" }, { page: 2, pageSize: 20 });
// → { data, total, page, pageSize, totalPages, hasMore }

// Cursor-based (Relay-style keyset)
const result = await repo.paginate(undefined, {
  first: 20,
  after: "cursor-string",
  orderBy: { createdAt: "DESC" },
});
// → { data, startCursor, endCursor, hasNextPage, hasPreviousPage }
```

`findPaginated` defaults to page 1 / pageSize 10 if not specified.

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
await repo.clear();
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
| `getRawRows()`      | `Array<Dict>`    |
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
qb.withDeleted().getMany(); // include soft-deleted
qb.withoutScope().getMany(); // bypass scope filter
qb.versionAt(new Date("2024-06-01")).getMany(); // point-in-time
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
const result = await qb
  .insert()
  .values([
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
  ])
  .returning("*")
  .execute();

await qb
  .update()
  .set({ status: "inactive" })
  .where({ lastLogin: { $lt: cutoffDate } })
  .execute();
await qb.delete().where({ status: "deleted" }).execute();
await qb
  .softDelete()
  .where({ expiresAt: { $lt: new Date() } })
  .execute();
```

### Per-Query Filter Overrides

```typescript
qb.setFilter("tenant", { tenantId: "tenant-xyz" }).getMany(); // enable + params
qb.setFilter("tenant", true).getMany(); // enable with source params
qb.setFilter("tenant", false).getMany(); // disable
```

### Cloning

```typescript
const baseQuery = qb.where({ status: "active" }).orderBy({ name: "ASC" });
const page1 = await baseQuery.clone().skip(0).take(10).getMany();
const page2 = await baseQuery.clone().skip(10).take(10).getMany();
```

### Debug

```typescript
const query = qb.where({ name: "Alice" }).toQuery(); // driver-specific representation
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
{ tags: { $length: 3 } }

// JSON containment
{ metadata: { $has: { role: "admin" } } }

// Modulo
{ age: { $mod: [2, 0] } }

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
  @JoinKey()
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

  @OneToOne(() => User, "profile")
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

  authorId!: string | null;
}
```

```typescript
const authorRepo = source.repository(Author);
const articleRepo = source.repository(Article);

const author = await authorRepo.save({
  name: "Alice",
  articles: [
    articleRepo.create({ title: "First Post" }),
    articleRepo.create({ title: "Second Post" }),
  ],
});

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

  @JoinTable()
  @ManyToMany(() => Student, "courses")
  students!: Student[];
}

@Entity()
class Student {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  name!: string;

  @ManyToMany(() => Course, "students")
  courses!: Course[];
}
```

```typescript
const alice = await studentRepo.insert({ name: "Alice" });
const bob = await studentRepo.insert({ name: "Bob" });

const math = await courseRepo.save({ name: "Mathematics", students: [alice, bob] });

math.students = [alice]; // removes Bob
await courseRepo.save(math);
```

### Eager vs Lazy Loading

```typescript
@Eager()
@OneToMany(() => Article, "author")
articles!: Article[];

@Lazy()
@OneToOne(() => Profile, "user")
profile!: LazyType<Profile | null>;

const user = await repo.findOne({ id }, { relations: ["posts"] }); // ad-hoc
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
```

If the callback throws, the transaction rolls back.

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

The same `client<T>()` method exists on `ITransactionContext` for transaction-scoped raw access.

## Lifecycle Hooks

Hooks run automatically during entity operations:

```typescript
const hashPassword = async (user: User) => {
  if (user.passwordChanged) {
    user.password = await argon2.hash(user.password);
  }
};

const setDefaults = (user: User) => {
  user.status ??= "active";
};

@Entity()
@OnCreate(setDefaults)
@BeforeInsert(hashPassword)
@BeforeUpdate(hashPassword)
@AfterLoad(async (user) => {
  user.fullName = `${user.firstName} ${user.lastName}`;
})
class User {
  /* ... */
}
```

See [Hook Execution Order](#hook-execution-order) for the full sequence.

## Lifecycle Events

`ProteusSource` is a typed event emitter. Subscribe to lifecycle and connection events to implement cross-cutting concerns like auditing, metrics, or alerting.

```typescript
source.on("entity:after-insert", async (event) => {
  await auditLog.write("insert", event.entity, event.metadata, event.meta);
});

source.on("entity:after-update", async (event) => {
  await auditLog.write("update", event.entity, event.metadata, event.meta);
  // event.oldEntity contains the snapshot before the update (when available)
});

source.on("connection:state", ({ state }) => {
  console.log(`Database is now ${state}`);
});

source.on("breaker:state", (event) => {
  console.warn("Circuit breaker state changed", event);
});
```

| Event                        | Payload                                       |
| ---------------------------- | --------------------------------------------- |
| `connection:state`           | `{ state: "connected" \| "disconnected" }`    |
| `breaker:state`              | `StateChangeEvent`                            |
| `entity:before-insert`       | `InsertEvent`                                 |
| `entity:after-insert`        | `InsertEvent`                                 |
| `entity:before-update`       | `UpdateEvent` (includes `oldEntity` snapshot) |
| `entity:after-update`        | `UpdateEvent`                                 |
| `entity:before-destroy`      | `DestroyEvent`                                |
| `entity:after-destroy`       | `DestroyEvent`                                |
| `entity:before-soft-destroy` | `SoftDestroyEvent`                            |
| `entity:after-soft-destroy`  | `SoftDestroyEvent`                            |
| `entity:before-restore`      | `RestoreEvent`                                |
| `entity:after-restore`       | `RestoreEvent`                                |
| `entity:after-load`          | `LoadEvent`                                   |

All entity event payloads share the same base shape:

```typescript
type EntityEventBase<E> = {
  entity: E;
  metadata: EntityMetadata;
  connection: unknown; // driver-specific connection handle
  meta: ProteusHookMeta; // request-scoped metadata
};
```

Listeners are awaited sequentially. Throwing from a listener propagates to the caller and triggers transaction rollback. Use `source.off(event, listener)` to unsubscribe and `source.once(event, listener)` for one-shot listeners.

## Soft Deletes & Expiry

### Soft Deletes

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

await repo.softDestroy(post); // sets deletedAt, fires hooks/cascades
await repo.softDelete({ status: "spam" }); // criteria-based, no per-entity hooks

const active = await repo.find();
const all = await repo.find(undefined, { withDeleted: true });
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
await repo.deleteExpired();
```

MongoDB automatically creates TTL indexes for `@ExpiryDateField`.

## Temporal Versioning

```typescript
@Entity()
class Product {
  @PrimaryKey()
  @Field("uuid")
  @Generated("uuid")
  id!: string;

  @VersionKeyField()
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

const snapshot = await repo.find(undefined, {
  versionTimestamp: new Date("2024-06-01"),
});

const history = await repo.versions({ id: product.id });
```

## Filters

Reusable, parameterized WHERE clauses at the entity level:

```typescript
@Entity()
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" }, default: true })
@Filter({ name: "active", condition: { status: "active" } })
class Resource {
  @PrimaryKeyField()
  id!: string;

  @Field("string")
  tenantId!: string;

  @Field("string")
  status!: string;
}

source.setFilterParams("tenant", { tenantId: "tenant-abc" });
source.enableFilter("active");
source.disableFilter("tenant");

// Per-query overrides
const qb = source.queryBuilder(Resource);
qb.setFilter("tenant", { tenantId: "tenant-xyz" }).getMany();
qb.setFilter("active", false).getMany();

// Or via FindOptions.filters
await repo.find(undefined, { filters: { tenant: { tenantId: "tenant-xyz" } } });
```

## Caching

Enable query-level caching with a pluggable adapter:

```typescript
import { MemoryCacheAdapter, RedisCacheAdapter } from "@lindorm/proteus";

new ProteusSource({
  driver: "postgres",
  cache: {
    adapter: new MemoryCacheAdapter({ maxEntries: 5000 }),
    ttl: "5m",
  },
  // ...
});

new ProteusSource({
  driver: "postgres",
  cache: {
    adapter: new RedisCacheAdapter({ host: "localhost", port: 6379 }),
    ttl: "10m",
  },
  // ...
});
```

The Redis adapter accepts either an existing `ioredis` client (which it does **not** own) or connection options (in which case the adapter owns the connection and `source.disconnect()` will close it).

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
const fresh = await repo.find({ status: "active" }, { cache: false });
```

`cache: true` enables caching using the entity-level `@Cache` TTL or the source default; if no TTL is configured anywhere, caching is silently disabled (no indefinite caching).

## Field-Level Encryption

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
  amphora,
  entities: [Patient],
  logger,
});
```

Values are encrypted before writing and decrypted after reading. Requires an `IAmphora` key store (peer dependency `@lindorm/amphora`).

## Naming Strategies

```typescript
new ProteusSource({
  driver: "postgres",
  naming: "snake",
  // ...
});
```

| Strategy           | Field Name   | Column Name  |
| ------------------ | ------------ | ------------ |
| `"none"` (default) | `firstName`  | `firstName`  |
| `"snake"`          | `firstName`  | `first_name` |
| `"camel"`          | `first_name` | `firstName`  |

Applies to column names, join keys, and find keys.

## Per-Request Isolation

`source.session()` creates a lightweight, request-scoped data-access handle that shares the parent's connection pool and entity metadata but carries its own logger, hook metadata, filter registry, and optional `AbortSignal`.

```typescript
app.use(async (ctx, next) => {
  ctx.db = source.session({ logger: ctx.logger, signal: ctx.signal });
  ctx.db.setFilterParams("tenant", { tenantId: ctx.state.tenantId });
  ctx.db.enableFilter("tenant");
  await next();
});

router.get("/users", async (ctx) => {
  const { page = 1, pageSize = 20 } = ctx.query;
  ctx.body = await ctx.db.repository(User).findPaginated(undefined, {
    page: Number(page),
    pageSize: Number(pageSize),
    order: { createdAt: "DESC" },
  });
});
```

Sessions are ephemeral. They expose only data-access methods (`repository`, `queryBuilder`, `client`, `transaction`, `ping`) plus the filter API — no lifecycle, event-subscription, or schema-management methods. Filter mutations on a session do not leak into the parent source.

The `signal` option is propagated to in-flight queries — when aborted, Postgres queries are cancelled server-side.

## Schema Synchronization & Migrations

### Auto Synchronization (Development)

```typescript
new ProteusSource({
  driver: "postgres",
  synchronize: true, // apply DDL changes on setup()
  // synchronize: "dry-run",    // log planned DDL without executing
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

The package ships a `proteus` binary for migration management and database diagnostics. Available commands:

### `proteus init`

```bash
proteus init -D postgres -d ./src/proteus
proteus init --dry-run
```

Scaffold a new Proteus source directory.

### `proteus generate entity`

```bash
proteus generate entity User -d ./src/proteus/entities
proteus g e User --dry-run
```

Generate an entity file pre-populated with Proteus decorators.

### Migration Commands

```bash
proteus migrate generate --name add-users-table
proteus migrate generate --interactive

proteus migrate create --name custom-data-migration
proteus migrate baseline --name initial

proteus migrate run
proteus migrate rollback --count 2
proteus migrate status

proteus migrate resolve --applied 20240101_add_users
proteus migrate resolve --rolled-back 20240101_add_users
```

### Database Commands

```bash
proteus db ping
```

### Shared Options

| Flag                     | Description                                                 |
| ------------------------ | ----------------------------------------------------------- |
| `-s, --source <path>`    | Path to source config file (default: `./proteus.config.ts`) |
| `-e, --export <name>`    | Named export from the config file                           |
| `-v, --verbose`          | Debug-level logging                                         |
| `-d, --directory <path>` | Output directory (where applicable)                         |

## Errors

Proteus provides typed error classes for precise error handling. All Proteus errors extend `ProteusError`.

| Error                      | When                                 |
| -------------------------- | ------------------------------------ |
| `DuplicateKeyError`        | Unique constraint violation          |
| `OptimisticLockError`      | Version mismatch on update           |
| `ForeignKeyViolationError` | FK constraint violation              |
| `NotNullViolationError`    | NULL in a non-nullable column        |
| `CheckConstraintError`     | Check constraint violation           |
| `DeadlockError`            | Transaction deadlock detected        |
| `SerializationError`       | Serializable isolation conflict      |
| `TransactionError`         | Transaction lifecycle error          |
| `MigrationError`           | Migration execution failure          |
| `SyncError`                | Schema synchronization failure       |
| `DriverError`              | Low-level driver error               |
| `NotSupportedError`        | Operation not supported by driver    |
| `CircuitOpenError`         | Circuit breaker is open              |
| `ExecutorError`            | Statement execution failure          |
| `ProteusRepositoryError`   | General repository error             |
| `EntityManagerError`       | Entity registration / metadata error |
| `EntityMetadataError`      | Entity metadata resolution error     |
| `EntityScannerError`       | Glob-based entity scanner error      |

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

## Test Mocks

Mock factories are exported under per-runner subpaths so the package itself does not depend on `jest` or `vitest`.

```typescript
// Vitest
import {
  createMockProteusSource,
  createMockProteusSession,
  createMockRepository,
} from "@lindorm/proteus/mocks/vitest";

const source = createMockProteusSource();
const session = createMockProteusSession();
const repo = createMockRepository<User>();
```

```typescript
// Jest
import {
  createMockProteusSource,
  createMockProteusSession,
  createMockRepository,
} from "@lindorm/proteus/mocks/jest";
```

Each factory returns a `Mocked<...>` (vitest) or `jest.Mocked<...>` (jest) implementation of the corresponding interface — every method is a typed mock function that you can configure per test.

## License

AGPL-3.0-or-later
