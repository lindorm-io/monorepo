# @lindorm/entity

Decorator-based entity metadata system with ORM-like features. Defines entities, columns, relations,
validation, versioning, and lifecycle hooks via TypeScript decorators. Persistence packages
(`@lindorm/mongo`, `@lindorm/redis`, `@lindorm/postgres`) consume the metadata at runtime.

---

## Installation

```bash
npm install @lindorm/entity
```

---

## Quick start

```ts
import { EntityBase, EntityKit, Column, Entity } from "@lindorm/entity";

@Entity()
export class User extends EntityBase {
  @Column("string")
  public name!: string;

  @Column("email")
  public email!: string;

  @Column("integer", { min: 0 })
  public age!: number;

  @Column("boolean", { fallback: true })
  public isActive!: boolean;
}

const kit = new EntityKit({ target: User, source: "MongoSource" });

const user = kit.create({ name: "Alice", email: "alice@example.com", age: 30 });
```

---

## Base classes

### `EntityBase`

Abstract base class providing:

- `id: string` -- UUID primary key (auto-generated)
- `createdAt: Date` -- creation timestamp

```ts
@Entity()
export class Product extends EntityBase {
  @Column("string")
  public name!: string;
}
```

### `VersionedEntityBase`

Extends `EntityBase` with versioning columns:

- `version: number` -- version counter
- `versionId: string` -- unique version identifier
- `versionStartAt: Date` -- when this version became active
- `versionEndAt: Date | null` -- when this version was superseded

```ts
@Entity()
export class Document extends VersionedEntityBase {
  @Column("string")
  public content!: string;
}
```

---

## Decorators

### Entity configuration

#### `@Entity(options?)`

Marks a class as a managed entity and registers it in the global metadata registry.

```ts
@Entity({
  name: "users",        // collection/table name override
  namespace: "auth",    // namespace prefix
})
export class User extends EntityBase {}
```

#### `@PrimarySource(source)`

Specifies which data source is the primary owner of this entity. Affects which repository runs
version increments and lifecycle hooks.

```ts
@Entity()
@PrimarySource("MongoSource")
export class User extends EntityBase {}
```

#### `@PrimaryKey(columns?)`

Marks one or more properties as the composite primary key. Can be used as a property decorator
(single column) or class decorator (multiple columns).

```ts
// Class decorator for composite keys
@Entity()
@PrimaryKey(["tenantId", "email"])
export class TenantUser {
  @Column("string")
  public tenantId!: string;

  @Column("email")
  public email!: string;
}

// Or property decorator for single key
@Entity()
export class Item {
  @PrimaryKey()
  @Column("uuid")
  public itemId!: string;
}
```

### Column decorators

#### `@Column(type?, options?)`

Defines a data column with type metadata.

```ts
@Column("string", { min: 1, max: 255, nullable: false })
public name!: string;

@Column("float", { min: 0, fallback: 0 })
public price!: number;

@Column("array", { fallback: [] })
public tags!: string[];

@Column("enum", { enum: ["active", "inactive", "pending"] })
public status!: string;

@Column("object", { optional: true })
public metadata?: Record<string, any>;
```

**Column types:** `string`, `uuid`, `email`, `url`, `enum`, `integer`, `float`, `bigint`,
`boolean`, `date`, `array`, `object`

**Column options:**

| Option | Type | Description |
|---|---|---|
| `enum` | `string[]` | Allowed values for enum type |
| `fallback` | `any \| () => any` | Default value or factory |
| `max` | `number` | Maximum value/length |
| `min` | `number` | Minimum value/length |
| `nullable` | `boolean` | Can be `null` |
| `optional` | `boolean` | Can be `undefined` |
| `readonly` | `boolean` | Cannot be modified after creation |
| `schema` | `ZodType` | Custom Zod validation schema |

### Special column decorators

All auto-configured with appropriate types and defaults:

| Decorator | Type | Description |
|---|---|---|
| `@PrimaryKeyColumn()` | `uuid` | Auto-generated UUID primary key |
| `@CreateDateColumn()` | `date` | Set once on creation |
| `@UpdateDateColumn()` | `date` | Updated on every save |
| `@DeleteDateColumn()` | `date` | Soft delete timestamp (nullable) |
| `@ExpiryDateColumn()` | `date` | TTL expiration (nullable) |
| `@ScopeColumn()` | `string` | Multi-tenancy scope |
| `@VersionColumn()` | `integer` | Optimistic locking counter |
| `@VersionKeyColumn()` | `uuid` | Unique version identifier |
| `@VersionStartDateColumn()` | `date` | Version start timestamp |
| `@VersionEndDateColumn()` | `date` | Version end timestamp (nullable) |

### `@Generated(strategy, options?)`

Auto-generates values on entity creation.

```ts
@Generated("uuid")
public externalId!: string;

@Generated("increment")
public orderNumber!: number;

@Generated("date")
public orderDate!: Date;

@Generated("integer", { min: 1000, max: 9999 })
public confirmationCode!: number;

@Generated("string", { length: 8, prefix: "ORD-" })
public referenceCode!: string;
```

### `@Index_(options?)`

Marks a column for database indexing.

```ts
@Column("string")
@Index_({ unique: true })
public email!: string;

@Column("date")
@Index_({ direction: "desc", sparse: true, name: "idx_created" })
public createdAt!: Date;
```

### `@Schema(zodSchema)`

Adds Zod validation that runs on `validate()`.

```ts
import { z } from "zod";

@Entity()
@Schema(z.object({
  email: z.string().email(),
  age: z.number().int().positive(),
}))
export class User extends EntityBase {
  @Column("email")
  public email!: string;

  @Column("integer")
  public age!: number;
}
```

### Lifecycle hooks

```ts
@OnCreate((entity) => {
  entity.slug = entity.title.toLowerCase().replace(/\s+/g, "-");
})
@OnValidate((entity) => {
  if (entity.startDate > entity.endDate) throw new Error("Invalid date range");
})
@OnInsert((entity) => { /* after first persistence */ })
@OnUpdate((entity) => { /* after update persistence */ })
@OnDestroy((entity) => { /* after deletion */ })
```

---

## Relations

Relations use thunks (`() => Constructor`) to avoid circular import issues. The second argument
is the **mirror property** on the foreign entity -- the property that points back to this entity.

### OneToMany / ManyToOne

```ts
@Entity()
export class Author extends EntityBase {
  @OneToMany(() => Book, "author", {
    loading: "eager",
    onInsert: "cascade",
    onUpdate: "cascade",
    onOrphan: "delete",
  })
  public books!: Book[];
}

@Entity()
export class Book extends EntityBase {
  @Column("uuid")
  public authorId!: string;  // FK column (auto-inferred from Author's PK)

  @ManyToOne(() => Author, "books")
  public author!: Author;
}
```

The ManyToOne side is the **owning side** -- it has the FK column. By default, `joinKeys` are
auto-inferred from the foreign entity's primary key columns. Use explicit `joinKeys` for custom FK
column names:

```ts
@ManyToOne(() => Author, "books", { joinKeys: { customAuthorId: "id" } })
public author!: Author;
```

### OneToOne

```ts
@Entity()
export class User extends EntityBase {
  @OneToOne(() => Profile, "user")        // inverse side (no FK)
  public profile!: Profile;
}

@Entity()
export class Profile extends EntityBase {
  @Column("uuid")
  public userId!: string;

  @OneToOne(() => User, "profile", { joinKeys: { userId: "id" } })  // owning side
  public user!: User;
}
```

### ManyToMany

Both sides need the decorator. One side must declare `hasJoinTable: true` (creates the join
table), the other declares `joinKeys` (the owning FK columns).

```ts
@Entity()
export class Student extends EntityBase {
  @ManyToMany(() => Course, "students", { hasJoinTable: true })
  public courses!: Course[];
}

@Entity()
export class Course extends EntityBase {
  @Column("uuid", { fallback: () => randomUUID() })
  public courseKey!: string;

  @ManyToMany(() => Student, "courses", { joinKeys: ["courseKey"] })
  public students!: Student[];
}
```

### Relation options

| Option | Values | Description |
|---|---|---|
| `loading` | `"eager"` / `"lazy"` / `"ignore"` | When to load the relation |
| `nullable` | `boolean` | Allow null for the relation |
| `onInsert` | `"cascade"` / `"ignore"` | Save related entities on insert |
| `onUpdate` | `"cascade"` / `"ignore"` | Save related entities on update |
| `onDestroy` | `"cascade"` / `"ignore"` | Delete related entities on destroy |
| `onOrphan` | `"delete"` / `"ignore"` | Delete unlinked entities on update |
| `joinKeys` | `Dict<string>` / `string[]` | Custom FK column mapping |
| `hasJoinTable` | `boolean` | This side creates the M2M join table |
| `hasJoinKey` | `boolean` | This side has the FK (OneToOne) |

---

## EntityKit

The runtime interface for entity operations. Used by persistence packages internally.

```ts
const kit = new EntityKit({
  target: User,
  source: "MongoSource",
  logger: myLogger,
  getNextIncrement: async (name) => nextVal(name),  // for @Generated("increment")
});
```

### Key methods

| Method | Description |
|---|---|
| `create(data?)` | Instantiate entity with defaults and generated values |
| `copy(entity)` | Shallow copy |
| `clone(entity)` | Deep clone with new ID/version |
| `validate(entity)` | Run `@Schema` and `@OnValidate` hooks |
| `insert(entity)` | Prepare for first persistence (set version=1, run `@OnInsert`) |
| `update(entity)` | Prepare for update (increment version, run `@OnUpdate`) |
| `document(entity)` | Convert to plain document for storage |
| `relationFilter(relation, entity)` | Build query predicate for loading relations |
| `onDestroy(entity)` | Run `@OnDestroy` hook |
| `getSaveStrategy(entity)` | Returns `"insert"`, `"update"`, or `"version"` |
| `getCollectionName(opts?)` | Computed collection/table name |
| `getIncrementName()` | Sequence name for auto-increment fields |

### Metadata access

```ts
kit.metadata.columns;      // Array<MetaColumn> -- all column definitions
kit.metadata.relations;    // Array<MetaRelation> -- all relation definitions
kit.metadata.primaryKeys;  // string[] -- primary key column names
kit.metadata.indexes;      // Array<MetaIndex> -- index definitions
kit.metadata.entity;       // MetaEntity -- entity-level config
kit.isPrimarySource;       // boolean -- is this the primary source?
kit.updateStrategy;        // "update" | "version"
```

---

## EntityScanner

Discovers entity classes from the filesystem at startup.

```ts
import { EntityScanner } from "@lindorm/entity";

const scanner = new EntityScanner();
const entities = await scanner.scan([
  "./src/entities",         // directory path
  "./src/models/User.ts",  // file path
  Customer,                // constructor directly
]);
```

---

## VersionManager

Manages version column lifecycle for optimistic locking.

```ts
import { VersionManager } from "@lindorm/entity";

const vm = new VersionManager(kit.metadata);

vm.isVersioned();           // true if entity has @VersionColumn
vm.getVersion(entity);      // current version number
vm.prepareForInsert(entity); // sets version to 1
vm.prepareForUpdate(entity); // increments version
```

---

## Utility functions

| Function | Description |
|---|---|
| `defaultCreateEntity(Target, data)` | Create entity instance with relation handling |
| `defaultCreateDocument(entity, metadata)` | Convert entity to storage document |
| `defaultCloneEntity(Target, entity, metadata)` | Deep clone with new identity |
| `defaultUpdateEntity(entity, data, metadata)` | Apply partial update to entity |
| `defaultGenerateEntity(entity, metadata, getIncrement)` | Run `@Generated` strategies |
| `defaultValidateEntity(entity, metadata)` | Run validation hooks and schemas |
| `defaultRelationFilter(relation, entity)` | Build find predicate from relation metadata |
| `getCollectionName(Target, opts?)` | Compute collection name from metadata |
| `getIncrementName(Target, opts?)` | Compute increment sequence name |
| `getJoinCollectionName(joinTable, opts?)` | Compute M2M join collection name |
| `getSaveStrategy(entity, metadata)` | Determine insert/update/version strategy |
| `removeReadonly(entity, metadata)` | Strip readonly fields for updates |
| `verifyReadonly(original, modified, metadata)` | Throw if readonly fields changed |
| `globalEntityMetadata` | Singleton metadata registry |

---

## Error classes

| Class | Description |
|---|---|
| `EntityKitError` | General entity operation errors |
| `EntityMetadataError` | Metadata configuration/registration errors |
| `EntityScannerError` | File scanning errors |

All extend `LindormError` from `@lindorm/errors`.

---

## License

AGPL-3.0-or-later
