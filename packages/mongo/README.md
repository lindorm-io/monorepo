# @lindorm/mongo

Type-safe MongoDB data layer built on the `@lindorm/entity` decorator system. Provides a
high-level repository abstraction with optimistic locking, relations, GridFS file storage, and
automatic index management.

---

## Installation

```bash
npm install @lindorm/mongo
```

Requires a running MongoDB instance. For local development:

```bash
docker compose -f ./packages/mongo/docker-compose.yml up -d
```

---

## Quick start

```ts
import { MongoSource } from "@lindorm/mongo";
import { EntityBase, Entity, Column, VersionColumn } from "@lindorm/entity";
import { Logger } from "@lindorm/logger";

@Entity()
class BlogPost extends EntityBase {
  @Column("string")
  public title!: string;

  @Column("string")
  public body!: string;

  @VersionColumn()
  public version!: number;
}

const source = new MongoSource({
  url: "mongodb://localhost:27017",
  database: "blog",
  entities: [BlogPost],
  logger: new Logger(),
});

await source.setup();

const posts = source.repository(BlogPost);
const post = posts.create({ title: "Hello", body: "World" });
await posts.insert(post);

const found = await posts.findOneOrFail({ title: "Hello" });
```

---

## MongoSource

Central factory that manages the MongoDB client connection and creates repositories and buckets.

```ts
const source = new MongoSource({
  url: "mongodb://localhost:27017",
  database: "mydb",
  entities: [User, Order, Product],
  files: [Avatar, Attachment],
  namespace: "prod",              // optional key prefix
  logger: myLogger,
  config: { /* MongoClientOptions */ },
});
```

### Connection lifecycle

```ts
await source.connect();     // connect to MongoDB
await source.setup();       // connect + create collections + indexes
await source.ping();        // verify connection is alive
await source.disconnect();  // close connection
```

### Factory methods

```ts
// Repository for entity CRUD
const repo = source.repository(User);

// GridFS bucket for file storage
const bucket = source.bucket(Avatar);

// Raw MongoDB collection access
const col = source.collection<Document>("raw_collection");

// Clone source (shares connection, override logger)
const cloned = source.clone({ logger: requestLogger });
```

### Runtime registration

```ts
source.addEntities([NewEntity, "./path/to/entities"]);
source.addFiles([NewFile]);

source.hasEntity(User);  // true
source.hasFile(Avatar);  // true
```

---

## MongoRepository

Full CRUD repository with relation support, optimistic locking, and lifecycle hooks.

### Entity lifecycle

```ts
const repo = source.repository(User);

const user = repo.create({ name: "Alice", email: "alice@example.com" });
repo.validate(user);

await repo.insert(user);                    // first persistence
await repo.update(user);                    // subsequent updates
await repo.save(user);                      // auto-detects insert vs update
await repo.destroy(user);                   // delete with cascade
```

### Query methods

```ts
// Find multiple
const users = await repo.find({ isActive: true });
const count = await repo.count({ isActive: true });
const exists = await repo.exists({ email: "alice@example.com" });

// Find single
const user = await repo.findOne({ email: "alice@example.com" });     // null if missing
const user = await repo.findOneOrFail({ email: "alice@example.com" }); // throws if missing
const user = await repo.findOneOrSave({ email: "alice@example.com" }, defaults); // upsert

// MongoDB cursor (for streaming large result sets)
const cursor = repo.cursor({ isActive: true }, { sort: { createdAt: -1 }, limit: 100 });

// TTL (seconds until expiry, requires @ExpiryDateColumn)
const seconds = await repo.ttl({ id: "abc" });

// Version history (requires VersionedEntityBase)
const versions = await repo.versions({ id: "abc" });
```

### Bulk operations

```ts
await repo.insertBulk([user1, user2, user3]);
await repo.saveBulk([user1, user2]);
await repo.updateBulk([user1, user2]);
await repo.destroyBulk([user1, user2]);
await repo.cloneBulk([user1, user2]);
```

### Delete operations

```ts
// Hard delete (cascades via destroy)
await repo.delete({ isActive: false });
await repo.destroy(user);

// Soft delete (sets @DeleteDateColumn, entity remains in DB)
await repo.softDelete({ isActive: false });
await repo.softDestroy(user);

// Clean up expired entities (@ExpiryDateColumn)
await repo.deleteExpired();

// Bulk update
await repo.updateMany({ isActive: false }, { deletedAt: new Date() });
```

### Clone (versioned entities)

```ts
const clone = await repo.clone(originalDocument);
// New ID, new version, persisted as separate entity
```

### Optimistic locking

Entities with `@VersionColumn` are automatically version-checked on update. If the stored version
doesn't match the entity's version, the update throws `MongoRepositoryError`.

---

## Relations

Relations defined via `@lindorm/entity` decorators are automatically loaded and cascaded.

### Loading strategies

```ts
// Eager: loaded immediately on find/findOne
@OneToMany(() => OrderItem, "order", { loading: "eager" })
public items!: OrderItem[];

// Lazy: loaded on first access (returns Promise-like proxy)
@ManyToOne(() => Customer, "orders", { loading: "lazy" })
public customer!: Customer;

// Ignore: not loaded automatically
@OneToMany(() => AuditLog, "entity", { loading: "ignore" })
public logs!: AuditLog[];
```

### Cascade operations

```ts
@OneToMany(() => OrderItem, "order", {
  loading: "eager",
  onInsert: "cascade",   // save items when order is inserted
  onUpdate: "cascade",   // save items when order is updated
  onDestroy: "cascade",  // delete items when order is destroyed
  onOrphan: "delete",    // delete items removed from the array on update
})
public items!: OrderItem[];
```

### ManyToMany

Uses a MongoDB join collection. The join collection name is auto-generated from the entity names
and join table option.

```ts
@Entity()
class User extends EntityBase {
  @ManyToMany(() => Role, "users", { hasJoinTable: true, loading: "eager" })
  public roles!: Role[];
}

@Entity()
class Role extends EntityBase {
  @ManyToMany(() => User, "roles", { joinKeys: ["roleKey"], loading: "eager" })
  public users!: User[];
}
```

---

## MongoBucket (GridFS)

Wrapper around MongoDB GridFS for storing and retrieving files.

```ts
import { MongoFileBase } from "@lindorm/mongo";
import { Entity } from "@lindorm/entity";

@Entity()
class Avatar extends MongoFileBase {
  @Column("uuid")
  public userId!: string;
}

const bucket = source.bucket(Avatar);

// Upload
const file = await bucket.upload(readableStream, {
  filename: "avatar.png",
  mimeType: "image/png",
  userId: "user-123",
});

// Download
const { stream, file } = await bucket.download("avatar.png");

// Query
const files = await bucket.find({ userId: "user-123" });
const file = await bucket.findOneOrFail({ filename: "avatar.png" });

// Delete
await bucket.delete({ filename: "avatar.png" });
```

`MongoFileBase` provides standard file metadata fields: `filename`, `uploadDate`, `chunkSize`,
`length`, `mimeType`, `originalName`, `encoding`, `hash`, `hashAlgorithm`, `size`, `strategy`.

---

## Testing

Mock factories for unit testing without a real MongoDB connection:

```ts
import { createMockMongoSource, createMockMongoRepository } from "@lindorm/mongo";

const source = createMockMongoSource();
const repo = createMockMongoRepository(User);

// All methods are jest.fn() mocks with sensible defaults
repo.create({ name: "test" });         // returns entity instance
await repo.find({ isActive: true });   // returns [entity]
await repo.insert(entity);            // resolves with entity
```

Available mocks:
- `createMockMongoSource()` -- full source mock with repository/bucket factories
- `createMockMongoRepository(Target, callback?)` -- repository mock
- `createMockMongoBucket(Target, callback?)` -- bucket mock

---

## License

AGPL-3.0-or-later
