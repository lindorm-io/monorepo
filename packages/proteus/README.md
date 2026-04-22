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
  - [Entity & Class-Level Decorators](#entity--class-level-decorators)
    - [`@Entity`](#entity)
    - [`@AbstractEntity`](#abstractentity)
    - [`@Embeddable`](#embeddable)
    - [`@Namespace`](#namespace)
    - [`@Schema`](#schema-1)
    - [`@Inheritance`](#inheritance-1)
    - [`@Discriminator`](#discriminator)
    - [`@DiscriminatorValue`](#discriminatorvalue)
    - [`@DefaultOrder`](#defaultorder)
    - [`@Cache`](#cache)
    - [`@Filter`](#filter)
    - [`@Check`](#check) (class-level)
    - [`@Index`](#index) (class-level)
    - [`@Unique`](#unique) (class-level)
    - [`@PrimaryKey`](#primarykey) (class-level)
  - [Field Decorators](#field-decorators)
    - [`@Field`](#field)
    - [`@PrimaryKeyField`](#primarykeyfield)
    - [`@PrimaryKey`](#primarykey-1) (field-level)
    - [`@ScopeField`](#scopefield)
    - [`@CreateDateField`](#createdatefield)
    - [`@UpdateDateField`](#updatedatefield)
    - [`@DeleteDateField`](#deletedatefield)
    - [`@VersionField`](#versionfield)
    - [`@VersionKeyField`](#versionkeyfield)
    - [`@VersionKey`](#versionkey)
    - [`@VersionStartDateField`](#versionstartdatefield)
    - [`@VersionEndDateField`](#versionenddatefield)
    - [`@ExpiryDateField`](#expirydatefield)
  - [Field Modifiers](#field-modifiers)
    - [`@Nullable`](#nullable)
    - [`@Default`](#default)
    - [`@Generated`](#generated)
    - [`@ReadOnly`](#readonly)
    - [`@Enum`](#enum)
    - [`@Precision`](#precision)
    - [`@Min` / `@Max`](#min--max)
    - [`@Comment`](#comment)
    - [`@Computed`](#computed)
    - [`@Transform`](#transform)
    - [`@Encrypted`](#encrypted)
    - [`@Hide`](#hide)
    - [`@Unique`](#unique-1) (field-level)
    - [`@Index`](#index-1) (field-level)
    - [`@Check`](#check-1) (class-level applied to field)
  - [Relation Decorators](#relation-decorators)
    - [`@OneToOne`](#onetoone)
    - [`@OneToMany`](#onetomany)
    - [`@ManyToOne`](#manytoone)
    - [`@ManyToMany`](#manytomany)
    - [`@Embedded`](#embedded)
    - [`@EmbeddedList`](#embeddedlist)
    - [`@JoinKey`](#joinkey)
    - [`@JoinTable`](#jointable)
    - [`@RelationId`](#relationid)
    - [`@RelationCount`](#relationcount)
  - [Relation Modifiers](#relation-modifiers)
    - [`@Cascade`](#cascade)
    - [`@Eager`](#eager)
    - [`@Lazy`](#lazy)
    - [`@OnOrphan`](#onorphan)
    - [`@Deferrable`](#deferrable)
    - [`@OrderBy`](#orderby)
  - [Lifecycle Hook Decorators](#lifecycle-hook-decorators)
    - [`@OnCreate`](#oncreate)
    - [`@OnValidate`](#onvalidate)
    - [`@OnHydrate`](#onhydrate)
    - [`@BeforeInsert` / `@AfterInsert`](#beforeinsert--afterinsert)
    - [`@BeforeUpdate` / `@AfterUpdate`](#beforeupdate--afterupdate)
    - [`@BeforeSave` / `@AfterSave`](#beforesave--aftersave)
    - [`@BeforeDestroy` / `@AfterDestroy`](#beforedestroy--afterdestroy)
    - [`@BeforeSoftDestroy` / `@AfterSoftDestroy`](#beforesoftdestroy--aftersoftdestroy)
    - [`@BeforeRestore` / `@AfterRestore`](#beforerestore--afterrestore)
    - [`@AfterLoad`](#afterload)
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

All decorators use the TC39 (stage 3) decorator specification. Class decorators receive `ClassDecoratorContext`, field/property decorators receive `ClassFieldDecoratorContext`. Metadata flows through the `Symbol.metadata` prototype chain, so abstract base class decorators are inherited by concrete subclasses.

### Entity & Class-Level Decorators

These decorators are applied to classes and configure entity-wide behavior.

#### `@Entity`

Marks a class as a persistent entity mapped to a database table or collection.

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

```typescript
@Embeddable()
class Address {
  @Field("string")
  street!: string;

  @Field("string")
  city!: string;
}
```

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

@Schema(
  z.object({
    name: z.string().min(1),
    email: z.string().email(),
  }),
)
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

Specifies which property serves as the discriminator column for table inheritance. Applied on the inheritance root class.

```typescript
@Entity()
@Inheritance("single-table")
@Discriminator("type") // "type" property distinguishes subtypes
class Vehicle {
  @Field("string")
  type!: string;
}
```

#### `@DiscriminatorValue`

Specifies the discriminator column value for a concrete subclass in a table inheritance hierarchy.

```typescript
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

**Argument:** `string | number`.

#### `@DefaultOrder`

Sets the default sort order for queries against this entity. Applied when `FindOptions.order` is not provided. Explicit `order` in FindOptions or `.orderBy()` on QueryBuilder takes precedence.

```typescript
@DefaultOrder({ createdAt: "DESC" })
@Entity()
class Post {
  /* ... */
}

@DefaultOrder({ lastName: "ASC", firstName: "ASC" })
@Entity()
class User {
  /* ... */
}
```

**Argument:** `Record<string, "ASC" | "DESC">`.

#### `@Cache`

Enables query-level caching for the entity. Requires a cache adapter configured on ProteusSource. Per-query caching can be overridden via `FindOptions.cache`.

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

```typescript
@AppendOnly()
@Entity()
class AuditLog {
  @PrimaryKeyField()
  id!: string;

  @CreateDateField()
  createdAt!: Date;

  @Field("string")
  action!: string;

  @Field("json")
  payload!: Record<string, unknown>;
}
```

**Allowed:** `insert`, `insertBulk`, `clone`, `find*`, `count`, `exists`, `aggregate`, `cursor`, `paginate`.

**Blocked:** `update`, `destroy`, `softDestroy`, `updateMany`, `softDelete`, `delete`, `upsert`, `clear`, `restore`.

For SQL drivers (PostgreSQL, MySQL, SQLite), `setup()` generates `BEFORE UPDATE` / `BEFORE DELETE` triggers that enforce immutability at the database level. PostgreSQL additionally generates a `BEFORE TRUNCATE` trigger.

#### `@Filter`

Declares a parameterized WHERE-clause filter on the entity. Filters are named, reusable predicates that can be enabled/disabled per-source or per-query. Use `"$paramName"` string placeholders for runtime-supplied values.

```typescript
@Entity()
@Filter({ name: "active", condition: { deletedAt: null }, default: true })
@Filter({ name: "tenant", condition: { tenantId: "$tenantId" } })
class Resource {
  /* ... */
}

// Set parameters at runtime
source.setFilterParams("tenant", { tenantId: "tenant-abc" });
source.enableFilter("active");
```

**Options:**

| Field       | Type              | Description                                   |
| ----------- | ----------------- | --------------------------------------------- |
| `name`      | `string`          | Unique filter name                            |
| `condition` | `Predicate<Dict>` | Filter condition using Predicate operators    |
| `default`   | `boolean`         | Auto-enable on every query (default: `false`) |

#### `@Check` (class-level)

Declares a CHECK constraint on the entity's table using a raw SQL boolean expression.

```typescript
@Check("price >= 0")
@Check("start_date < end_date", { name: "chk_date_range" })
@Entity()
class Product {
  /* ... */
}
```

**Arguments:** `(expression: string, options?: { name?: string })`. Constraint name is auto-generated if omitted.

#### `@Index` (class-level)

Declares a composite database index across multiple fields.

```typescript
// Simple composite index
@Index<typeof User>(["lastName", "firstName"])
@Entity()
class User {
  /* ... */
}

// Per-field direction
@Index<typeof User>({ lastName: "asc", firstName: "asc", createdAt: "desc" })
@Entity()
class User {
  /* ... */
}

// Partial index with custom method
@Index<typeof User>(["email"], { unique: true, where: "deleted_at IS NULL" })
@Entity()
class User {
  /* ... */
}
```

**Options:**

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
@Unique<typeof User>(["email", "tenantId"])
@Unique<typeof User>(["email", "tenantId"], { name: "uq_tenant_email" })
@Entity()
class User {
  /* ... */
}
```

**Arguments:** `(keys: Array<keyof T>, options?: { name?: string })`.

#### `@PrimaryKey` (class-level)

Defines a composite primary key across multiple fields.

```typescript
@PrimaryKey<typeof OrderItem>(["orderId", "productId"])
@Entity()
class OrderItem {
  @Field("uuid")
  orderId!: string;

  @Field("uuid")
  productId!: string;
}
```

---

### Field Decorators

These decorators are applied to class properties and declare persistent columns.

#### `@Field`

The foundational field decorator. Declares a persistent column with an explicit type.

```typescript
@Field("string")
name!: string;

@Field("string", { name: "full_name" }) // custom column name
name!: string;

@Field("array", { arrayType: "string" })
tags!: string[];
```

**Arguments:** `(type: MetaFieldType, options?: { name?: string, arrayType?: string })`. Column name defaults to the property name.

#### `@PrimaryKeyField`

Shorthand that combines `@Field`, `@PrimaryKey`, and `@Generated` in one decorator.

```typescript
@PrimaryKeyField()          // UUID primary key (default)
id!: string;

@PrimaryKeyField("integer") // auto-increment integer PK
id!: number;

@PrimaryKeyField("string")  // random string PK
id!: string;

@PrimaryKeyField("uuid", { name: "pk" }) // custom column name
id!: string;
```

**Arguments:** `(type?: "uuid" | "integer" | "string", options?: { name?: string })`. Defaults to `"uuid"`. The field is automatically marked read-only and auto-generated.

#### `@PrimaryKey` (field-level)

Marks a single field as part of the primary key. Use this instead of `@PrimaryKeyField` when you need to control the field type, generation strategy, or other modifiers separately.

```typescript
@PrimaryKey()
@Field("integer")
@Generated("increment")
id!: number;
```

#### `@ScopeField`

Declares a scope field for multi-tenancy or logical partitioning. Scope fields are automatically non-nullable, read-only strings with a minimum length of 1.

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
2. **Automatic query filtering** — scope fields are auto-registered as a `__scope` system filter. Queries are scoped by default. Bypass with `{ withoutScope: true }` in FindOptions.

**Options:** `{ name?: string, order?: number }`.

#### `@CreateDateField`

Declares a timestamp field automatically set to the current time on insert. Read-only and immutable after creation.

```typescript
@CreateDateField()
createdAt!: Date;

@CreateDateField({ name: "created_at" })
createdAt!: Date;
```

#### `@UpdateDateField`

Declares a timestamp field automatically set to the current time on every update.

```typescript
@UpdateDateField()
updatedAt!: Date;
```

#### `@DeleteDateField`

Declares a nullable timestamp field for soft-delete tracking. When non-null, the entity is considered soft-deleted and excluded from queries by default.

```typescript
@DeleteDateField()
deletedAt!: Date | null;
```

Use `{ withDeleted: true }` in FindOptions to include soft-deleted rows. See [Soft Deletes & Expiry](#soft-deletes--expiry).

#### `@VersionField`

Declares an integer field for optimistic locking. Automatically incremented on every update. The ORM checks the version matches before applying updates and throws `OptimisticLockError` on conflict.

```typescript
@VersionField()
version!: number;
```

Read-only and non-nullable.

#### `@VersionKeyField`

Shorthand combining `@Field`, `@PrimaryKey`, `@VersionKey`, and `@Generated` for temporal/versioned tables. Part of the composite primary key alongside the regular primary key.

```typescript
@VersionKeyField()          // UUID version key (default)
versionId!: string;

@VersionKeyField("integer") // auto-increment version key
versionId!: number;
```

**Arguments:** `(type?: "uuid" | "integer" | "string", options?: { name?: string })`.

#### `@VersionKey`

Marks a field as a version key for temporal tables. Can be used at field level or class level for composite version keys.

```typescript
// Field-level
@VersionKey()
@Field("uuid")
@Generated("uuid")
versionId!: string;

// Class-level composite
@VersionKey<typeof Product>(["versionId", "locale"])
@Entity()
class Product { /* ... */ }
```

#### `@VersionStartDateField`

Declares the start timestamp for temporal/versioned tables. Set on insert and when a new version is created.

```typescript
@VersionStartDateField()
validFrom!: Date;
```

Read-only, non-nullable, auto-generated.

#### `@VersionEndDateField`

Declares the end timestamp for temporal/versioned tables. Nullable — `null` means the version is the current active version.

```typescript
@VersionEndDateField()
validTo!: Date | null;
```

Set automatically when a new version supersedes an existing one.

#### `@ExpiryDateField`

Declares a nullable timestamp field for TTL-based expiry. Use `repository.deleteExpired()` to purge expired entities and `repository.ttl()` to check remaining time.

```typescript
@ExpiryDateField()
expiresAt!: Date | null;
```

MongoDB automatically creates TTL indexes for `@ExpiryDateField`. See [Soft Deletes & Expiry](#soft-deletes--expiry).

---

### Field Modifiers

These decorators modify the behavior of a field declared with `@Field` or one of the shorthand field decorators. Stack them on the same property.

#### `@Nullable`

Marks a field as nullable, allowing `null` values. Affects both DDL generation and Zod validation. Without this, fields are non-nullable by default.

```typescript
@Nullable()
@Field("string")
email!: string | null;
```

#### `@Default`

Sets a default value for a field, applied when creating new entities. Accepts a literal value or a function returning the default at creation time.

```typescript
@Default(0)
@Field("integer")
loginCount!: number;

@Default(true)
@Field("boolean")
active!: boolean;

@Default(() => new Date())
@Field("timestamp")
startedAt!: Date;
```

**Argument:** `value | () => value`.

#### `@Generated`

Marks a field as auto-generated by the ORM or database.

```typescript
@Generated("uuid")                   // UUID v4 on insert
@Generated("increment")              // database auto-increment
@Generated("string")                 // random string (default length)
@Generated("string", { length: 12 }) // random string with custom length
@Generated("date")                   // current timestamp on insert
```

**Strategies:**

| Strategy      | Description                              |
| ------------- | ---------------------------------------- |
| `"uuid"`      | Generate UUID v4 on insert               |
| `"increment"` | Database auto-increment sequence         |
| `"string"`    | Random string with configurable `length` |
| `"date"`      | Current timestamp                        |

**Options:** `{ length?: number, max?: number, min?: number }`.

#### `@ReadOnly`

Marks a field as read-only. Excluded from UPDATE statements after initial insert. The value is still set during entity creation.

```typescript
@ReadOnly()
@Field("string")
createdBy!: string;
```

#### `@Enum`

Restricts a field to a fixed set of allowed values. Pass a TypeScript enum or a plain `Record<string, string | number>`. Enforced during Zod validation and mapped to a CHECK constraint or native ENUM type depending on driver.

```typescript
enum Status {
  Active = "active",
  Inactive = "inactive",
  Banned = "banned",
}

@Enum(Status)
@Field("enum")
status!: Status;
```

#### `@Precision`

Sets precision and scale for numeric fields (decimal, float, real).

```typescript
@Precision(10)     // 10 significant digits, 0 decimal places
@Field("decimal")
total!: number;

@Precision(10, 2)  // 10 significant digits, 2 decimal places → NUMERIC(10, 2)
@Field("decimal")
price!: number;
```

**Arguments:** `(precision: number, scale?: number)`. Scale defaults to `0`.

> **Note:** There is no separate `@Scale` decorator — scale is the second argument to `@Precision`.

#### `@Min` / `@Max`

Set minimum/maximum bounds for numeric fields or minimum/maximum length for string fields. Enforced during Zod validation and reflected in DDL constraints where supported.

```typescript
@Min(0)
@Max(150)
@Field("integer")
age!: number;

@Min(1)
@Max(255)
@Field("string")
username!: string;
```

#### `@Comment`

Attaches a DDL comment to a column (e.g. PostgreSQL `COMMENT ON COLUMN`).

```typescript
@Comment("ISO 4217 currency code")
@Field("string")
currency!: string;
```

#### `@Computed`

Marks a field as a computed/generated column with a SQL expression. Computed fields are excluded from INSERT/UPDATE statements and Zod validation. The database evaluates the expression.

```typescript
@Computed("first_name || ' ' || last_name")
@Field("string")
fullName!: string;

@Computed("EXTRACT(YEAR FROM created_at)")
@Field("integer")
createdYear!: number;
```

**Argument:** SQL expression string. Read-only by definition.

#### `@Transform`

Applies a bidirectional transform to a field value. `to` runs during dehydration (entity -> database), `from` runs during hydration (database -> entity).

```typescript
@Transform({
  to: (value: string[]) => value.join(","),
  from: (raw: string) => raw.split(","),
})
@Field("string")
tags!: string[];

@Transform<Date, number>({
  to: (date) => date.getTime(),
  from: (ms) => new Date(ms),
})
@Field("bigint")
timestamp!: Date;
```

**Options:** `{ to: (value: TFrom) => TTo, from: (raw: TTo) => TFrom }`.

#### `@Encrypted`

Marks a field for application-level encryption at rest. Values are encrypted before writing and decrypted after reading. Requires an `IAmphora` key store configured on ProteusSource.

```typescript
@Encrypted()
@Field("string")
ssn!: string;

@Encrypted({ purpose: "pii", ownerId: "userId" })
@Field("json")
medicalRecord!: Record<string, unknown>;
```

**Options:** `{ id?, algorithm?, encryption?, purpose?, type?, ownerId? }` — metadata for encryption strategy and scope.

#### `@Hide`

Excludes a field from query results for a given scope. The field still exists in the database and entity; it is just excluded from SELECT projections.

```typescript
@Hide()           // hidden from both findOne and find results
@Field("string")
password!: string;

@Hide("single")   // hidden only from findOne
@Field("json")
metadata!: Record<string, unknown>;

@Hide("multiple") // hidden only from find (list queries)
@Field("text")
body!: string;
```

**Argument:** `"single" | "multiple"` or omit for both.

#### `@Unique` (field-level)

Declares a unique constraint on a single field.

```typescript
@Unique()
@Field("string")
email!: string;

@Unique({ name: "uq_email" }) // custom constraint name
@Field("string")
email!: string;
```

#### `@Index` (field-level)

Declares a database index on a single field.

```typescript
@Index()                          // ascending index (default)
@Field("string")
email!: string;

@Index("desc")                    // descending index
@Field("timestamp")
createdAt!: Date;

@Index({ unique: true })          // unique index
@Field("string")
slug!: string;

@Index({ where: "active = true" }) // partial index
@Field("string")
email!: string;

@Index({ using: "gin" })          // custom index method
@Field("json")
metadata!: Record<string, unknown>;
```

#### `@Check` (class-level applied to field)

`@Check` is always a class-level decorator, but it can reference specific fields in its expression. See [`@Check`](#check) above.

---

### Relation Decorators

Relation decorators define relationships between entities. Each relation has an **owning side** (stores the FK or join table reference) and an **inverse side**.

#### `@OneToOne`

Declares a one-to-one relation between two entities. Use `@JoinKey()` on the owning side to mark FK ownership.

```typescript
@Entity()
class User {
  @JoinKey() // owning side — stores the FK
  @OneToOne(() => Profile, "user")
  profile!: Profile | null;
}

@Entity()
class Profile {
  @OneToOne(() => User, "profile") // inverse side — no @JoinKey
  user!: User | null;
}
```

**Arguments:** `(entityFn: () => Constructor, entityKey: keyof F, options?: { strategy?: string })`.

- `entityFn` — thunk returning the related entity constructor (avoids circular imports)
- `entityKey` — property name on the related entity that holds the back-reference

#### `@OneToMany`

Declares a one-to-many relation (inverse side). This entity has no FK column; the related entity's `@ManyToOne` side owns the join key.

```typescript
@Entity()
class Author {
  @OneToMany(() => Article, "author")
  articles!: Article[];
}
```

#### `@ManyToOne`

Declares a many-to-one relation (owning side). This entity's table gets the FK column(s).

```typescript
@Entity()
class Article {
  @ManyToOne(() => Author, "articles")
  author!: Author | null;
}
```

#### `@ManyToMany`

Declares a many-to-many relation using a join table. Use `@JoinTable()` on the owning side.

```typescript
@Entity()
class Course {
  @JoinTable() // owning side
  @ManyToMany(() => Student, "courses")
  students!: Student[];
}

@Entity()
class Student {
  @ManyToMany(() => Course, "students") // inverse side
  courses!: Course[];
}
```

#### `@Embedded`

Declares a field that embeds an `@Embeddable()` class as flat columns in the parent table. Column names are prefixed by default with `${fieldName}_`.

```typescript
@Embedded(() => Address)                     // prefix: "homeAddress_"
homeAddress!: Address | null;

@Embedded(() => Address, { prefix: "work_" }) // custom prefix
workAddress!: Address | null;
```

**Arguments:** `(embeddableFn: () => Constructor, options?: { prefix?: string })`.

#### `@EmbeddedList`

Declares a field storing an array of primitives or embeddables in a separate owned collection table. The collection table has no PK and no independent lifecycle — deleting the parent cascades to collection rows.

```typescript
@EmbeddedList(() => Address)                           // array of embeddables
addresses!: Address[];

@EmbeddedList("string")                                // array of primitives
tags!: string[];

@EmbeddedList("string", { tableName: "user_tags" })    // custom table name
tags!: string[];
```

**Arguments:** `(typeOrFn: MetaFieldType | (() => Constructor), options?: { tableName?: string })`.

##### Loading: lazy by default on `find()`, eager by default on `findOne()`

`@EmbeddedList` fields obey the same `@Eager` / `@Lazy` decorators as relations, with the JPA `@ElementCollection` default: **`{ single: "eager", multiple: "lazy" }`**. JPA settled on lazy-on-list because element collections are a separate batched query against a separate table — eager-by-default on every `find()` is a footgun that surfaces only under load.

What this means in practice:

- `repo.findOne(...)` returns plain arrays for every embedded list field.
- `repo.find(...)` returns a `LazyCollection<T>` thenable on each embedded list field. `await row.tags` resolves to the actual array and replaces the property by identity, so subsequent reads are plain arrays.

Override per scope when the default does not fit:

```typescript
@Eager()                  // both findOne and find load eagerly
@EmbeddedList("string")
operations!: string[];

@Eager("multiple")        // force eager on list queries
@EmbeddedList("string")
certificateChain!: string[];

@Lazy("single")           // force lazy thenable on findOne
@EmbeddedList("string")
auditLog!: string[];
```

The cursor APIs (`cursor()`, `stream()`) follow the `"multiple"` scope, so a `@Lazy("multiple")` (or default) embedded list yields thenables on every cursor batch.

#### `@JoinKey`

Marks a relation field as the owning side (has FK column) and optionally provides explicit join key mapping.

```typescript
@JoinKey()                              // auto-detect FK columns
@OneToOne(() => Profile, "user")
profile!: Profile | null;

@JoinKey({ authorId: "id" })            // explicit: localCol → foreignCol
@ManyToOne(() => Author, "articles")
author!: Author | null;
```

**Argument:** `Dict<string>?` — `{ localColumn: "foreignColumn" }`. If omitted, columns are auto-calculated from property names and relation metadata.

#### `@JoinTable`

Configures the join table for a `@ManyToMany` relation. Place on the owning side only.

```typescript
@JoinTable()                                // auto-generated table name
@ManyToMany(() => Tag, "posts")
tags!: Tag[];

@JoinTable({ name: "post_tags" })           // custom join table name
@ManyToMany(() => Tag, "posts")
tags!: Tag[];
```

**Options:** `{ name?: string }`. Only one side of a ManyToMany should have `@JoinTable`.

#### `@RelationId`

Exposes a relation's FK value as a read-only property on the entity.

```typescript
@RelationId("author")           // auto-detect FK column
authorId!: string;

@RelationId("author", { column: "author_id" }) // explicit column
authorId!: string;
```

For `*ToOne` owning relations, the FK column is auto-detected. For composite FK or `*ToMany`, specify the `column` option. Multiple `@RelationId` decorators may target the same relation for composite keys.

#### `@RelationCount`

Populates a field with the count of a related collection, loaded via a batched `COUNT(*) ... GROUP BY` query. Avoids loading the full relation just to get the count. Supports OneToMany and ManyToMany relations, including composite keys.

```typescript
@Entity()
class Blog {
  @PrimaryKeyField()
  id!: string;

  @OneToMany(() => Comment, "blog")
  comments!: Comment[];

  @RelationCount<Blog>("comments")
  @Field("integer")
  commentCount!: number;
}
```

**Arguments:** `(relationKey: keyof E & string)` — the property name of the relation to count. The field must also have `@Field("integer")`.

Supported on PostgreSQL, MySQL, and SQLite. MongoDB, Redis, and Memory drivers load relation counts via their own relation-loading pipelines.

---

### Relation Modifiers

These decorators modify the behavior of a relation declared with `@OneToOne`, `@OneToMany`, `@ManyToOne`, or `@ManyToMany`. Stack them on the same property.

#### `@Cascade`

Configures cascade behavior for a relation. Controls what happens to related entities when the parent is inserted, updated, destroyed, or soft-destroyed.

```typescript
@Cascade({ onInsert: "cascade", onUpdate: "cascade", onDestroy: "cascade" })
@OneToMany(() => Article, "author")
articles!: Article[];

@Cascade({ onDestroy: "soft", onSoftDestroy: "cascade" })
@OneToMany(() => Comment, "post")
comments!: Comment[];
```

**Options:**

| Field           | Values                  | Description                                   |
| --------------- | ----------------------- | --------------------------------------------- |
| `onInsert`      | `"cascade"`             | Auto-insert related entities with parent      |
| `onUpdate`      | `"cascade"`             | Auto-update related entities with parent      |
| `onDestroy`     | `"cascade"` \| `"soft"` | Delete or soft-delete related on hard delete  |
| `onSoftDestroy` | `"cascade"` \| `"soft"` | Cascade or soft-delete related on soft delete |

#### `@Eager`

Automatically loads a relation alongside every query result (eager loading).

```typescript
@Eager()           // eager-load for both findOne and find
@OneToMany(() => Article, "author")
articles!: Article[];

@Eager("single")   // only eager-load for findOne
@OneToOne(() => Profile, "user")
profile!: Profile | null;

@Eager("multiple") // only eager-load for find (list queries)
@OneToMany(() => Tag, "post")
tags!: Tag[];
```

**Argument:** `"single" | "multiple"` or omit for both. Also applies to `@EmbeddedList` fields — see [`@EmbeddedList` loading](#loading-lazy-by-default-on-find-eager-by-default-on-findone).

#### `@Lazy`

Loads a relation lazily — the property returns a `PromiseLike<T>` that resolves on first access.

```typescript
@Lazy()
@OneToOne(() => Profile, "user")
profile!: LazyType<Profile | null>;

@Lazy("single")   // only lazy-load for findOne
@Lazy("multiple") // only lazy-load for find
```

Use `LazyType<T>` as the property type for lazy-loaded relations.

**Argument:** `"single" | "multiple"` or omit for both. Also applies to `@EmbeddedList` fields — see [`@EmbeddedList` loading](#loading-lazy-by-default-on-find-eager-by-default-on-findone).

#### `@OnOrphan`

Configures what happens to related entities that are removed from a collection (e.g. when reassigning a `@OneToMany` array).

```typescript
@OnOrphan("destroy")       // permanently delete orphaned entities
@OneToMany(() => Comment, "post")
comments!: Comment[];

@OnOrphan("soft-destroy")  // soft-delete orphaned entities
@OnOrphan("nullify")       // set the FK to null
@OnOrphan("ignore")        // do nothing (default)
```

**Argument:** `"destroy" | "soft-destroy" | "nullify" | "ignore"`.

#### `@Deferrable`

Marks a relation's FK constraint as `DEFERRABLE`, allowing constraint checks to be deferred until transaction end. Useful for circular dependencies.

```typescript
@Deferrable()                      // DEFERRABLE INITIALLY IMMEDIATE
@ManyToOne(() => Category, "children")
parent!: Category | null;

@Deferrable({ initially: true })   // DEFERRABLE INITIALLY DEFERRED
@ManyToOne(() => Node, "children")
parent!: Node | null;
```

**Options:** `{ initially?: boolean }`. When `true`, the constraint is `INITIALLY DEFERRED`.

#### `@OrderBy`

Specifies default ordering for a relation's loaded results. Applied as an `ORDER BY` clause in SQL relation queries and as in-memory sorting during hydration. Supported across all six drivers.

```typescript
@OrderBy({ createdAt: "DESC" })
@OneToMany(() => Comment, "post")
comments!: Comment[];

@OrderBy({ lastName: "ASC", firstName: "ASC" })
@OneToMany(() => Player, "team")
players!: Player[];
```

**Argument:** `Record<string, "ASC" | "DESC">`.

---

### Lifecycle Hook Decorators

Lifecycle hooks are **class decorators** that register callbacks at specific points in the entity lifecycle. All hooks receive `(entity, context)` as arguments, where `context` is a `ProteusHookMeta` carrying request-scoped metadata (`correlationId`, `actor`, `timestamp`).

**Async hooks** (`HookCallback<T>`) may return `void | Promise<void>`.
**Sync hooks** (`SyncHookCallback<T>`) must return `void` — they cannot be async.

#### `@OnCreate`

Fires synchronously when `repository.create()` builds a new entity instance. **Must be synchronous.** Useful for setting computed defaults or derived fields.

```typescript
@OnCreate((user, _ctx) => {
  user.slug = user.name.toLowerCase().replace(/\s+/g, "-");
})
@Entity()
class User {
  /* ... */
}
```

#### `@OnValidate`

Fires synchronously during `repository.validate()`, after the built-in Zod schema check. Throw to reject the entity. **Must be synchronous.**

```typescript
@OnValidate((order, _ctx) => {
  if (order.startDate >= order.endDate) {
    throw new Error("startDate must be before endDate");
  }
})
@Entity()
class Order {
  /* ... */
}
```

#### `@OnHydrate`

Fires synchronously when an entity is hydrated from database results, after all fields and FK columns are populated but before the entity is returned. **Must be synchronous.** For async post-load enrichment, use `@AfterLoad` instead.

```typescript
@OnHydrate((user, _ctx) => {
  user.fullName = `${user.firstName} ${user.lastName}`;
})
@Entity()
class User {
  /* ... */
}
```

#### `@BeforeInsert` / `@AfterInsert`

Fire around INSERT operations. `@BeforeInsert` runs after validation but before the INSERT statement. `@AfterInsert` runs after the entity is persisted. Both may be async.

```typescript
@BeforeInsert(async (user, _ctx) => {
  user.password = await argon2.hash(user.password);
})
@AfterInsert(async (user, _ctx) => {
  await sendWelcomeEmail(user.email);
})
@Entity()
class User {
  /* ... */
}
```

#### `@BeforeUpdate` / `@AfterUpdate`

Fire around UPDATE operations. `@BeforeUpdate` runs after validation and version check but before the UPDATE statement. Both may be async.

```typescript
@BeforeUpdate(async (user, _ctx) => {
  if (user.passwordChanged) {
    user.password = await argon2.hash(user.password);
  }
})
@Entity()
class User {
  /* ... */
}
```

#### `@BeforeSave` / `@AfterSave`

Fire around both INSERT and UPDATE operations. `@BeforeSave` runs before `@BeforeInsert`/`@BeforeUpdate`. `@AfterSave` runs after `@AfterInsert`/`@AfterUpdate`. Both may be async.

```typescript
@BeforeSave((entity, _ctx) => {
  entity.updatedBy = getCurrentUserId();
})
@Entity()
class Document {
  /* ... */
}
```

#### `@BeforeDestroy` / `@AfterDestroy`

Fire around hard DELETE operations. `@BeforeDestroy` runs before cascade deletes and the DELETE statement. Both may be async.

```typescript
@BeforeDestroy(async (user, _ctx) => {
  await deleteUserFiles(user.id);
})
@Entity()
class User {
  /* ... */
}
```

#### `@BeforeSoftDestroy` / `@AfterSoftDestroy`

Fire around soft-delete operations. `@BeforeSoftDestroy` runs before the delete date is set and before cascade soft-deletes. Both may be async.

```typescript
@BeforeSoftDestroy(async (post, _ctx) => {
  await notifyAuthor(post.authorId, "post archived");
})
@Entity()
class Post {
  /* ... */
}
```

#### `@BeforeRestore` / `@AfterRestore`

Fire around restore operations (un-soft-delete). `@BeforeRestore` runs before the delete date is cleared. Both may be async.

```typescript
@AfterRestore(async (post, _ctx) => {
  await reindexPost(post.id);
})
@Entity()
class Post {
  /* ... */
}
```

#### `@AfterLoad`

Fires after an entity is loaded from the database, after hydration and relation loading. May be async. Use for post-load enrichment.

```typescript
@AfterLoad(async (user, _ctx) => {
  user.avatarUrl = await resolveAvatarUrl(user.avatarKey);
})
@Entity()
class User {
  /* ... */
}
```

### Hook Execution Order

| Phase        | Hooks (in order)                                                              |
| ------------ | ----------------------------------------------------------------------------- |
| Construction | `@OnCreate` (sync)                                                            |
| Validation   | `@OnValidate` (sync)                                                          |
| Insert       | `@BeforeSave` -> `@BeforeInsert` -> persist -> `@AfterInsert` -> `@AfterSave` |
| Update       | `@BeforeSave` -> `@BeforeUpdate` -> persist -> `@AfterUpdate` -> `@AfterSave` |
| Destroy      | `@BeforeDestroy` -> delete -> `@AfterDestroy`                                 |
| Soft Delete  | `@BeforeSoftDestroy` -> mark -> `@AfterSoftDestroy`                           |
| Restore      | `@BeforeRestore` -> unmark -> `@AfterRestore`                                 |
| Hydration    | `@OnHydrate` (sync) -> `@AfterLoad`                                           |

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

### Execution Order

See [Hook Execution Order](#hook-execution-order) in the Decorators section for the complete execution order table.

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
  condition: { tenantId: "$tenantId" },
  default: true, // enabled by default
})
@Filter({
  name: "active",
  condition: { status: "active" },
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
