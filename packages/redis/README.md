# @lindorm/redis

Type-safe Redis data layer built on [ioredis](https://github.com/redis/ioredis) and the
`@lindorm/entity` decorator system. Provides entity persistence via Redis Hashes, relation support,
TTL handling, and a Redis Streams message bus.

Follows the same repository pattern as `@lindorm/mongo` and `@lindorm/postgres`, making it easy
to swap between persistence backends.

---

## Installation

```bash
npm install @lindorm/redis
```

Requires a running Redis instance. For local development:

```bash
docker compose -f ./packages/redis/docker-compose.yml up -d
```

---

## Quick start

```ts
import { RedisSource } from "@lindorm/redis";
import { EntityBase, Entity, Column, ExpiryDateColumn } from "@lindorm/entity";
import { Logger } from "@lindorm/logger";

@Entity()
class Session extends EntityBase {
  @Column("string")
  public userId!: string;

  @Column("object", { fallback: {} })
  public data!: Record<string, any>;

  @ExpiryDateColumn()
  public expiresAt!: Date | null;
}

const source = new RedisSource({
  url: "redis://localhost:6379/0",
  entities: [Session],
  namespace: "prod",
  logger: new Logger(),
});

await source.setup();

const repo = source.repository(Session);
const session = repo.create({
  userId: "user-123",
  data: { theme: "dark" },
  expiresAt: new Date(Date.now() + 3600_000), // 1 hour TTL
});

await repo.insert(session);

const found = await repo.findOneOrFail({ userId: "user-123" });
```

---

## Storage model

Entities are stored as **Redis Hashes** (one hash per entity). Each column is a hash field with
type-aware serialization:

| Column type | Stored as | Example |
|---|---|---|
| `string`, `uuid`, `email`, `url`, `enum` | string | `"alice@example.com"` |
| `integer`, `float` | string | `"42"`, `"3.14"` |
| `bigint` | string | `"9007199254740993"` |
| `boolean` | `"true"` / `"false"` | `"true"` |
| `date` | ISO 8601 string | `"2024-01-01T00:00:00.000Z"` |
| `array`, `object` | Primitive envelope | `{"__meta__":...,"__record__":...}` |
| `null` / `undefined` | omitted | (field not present in hash) |

`array` and `object` types use `Primitive` from `@lindorm/json-kit` to preserve nested rich types
(Date, Buffer, BigInt, null vs undefined) through the serialization round-trip.

**Key format:** `{namespace}.{collectionName}{.scope}.{pk1}:{val1}.{pk2}:{val2}`

### Why Hashes?

- **Field-level reads:** `HGET` for single fields (used for optimistic locking version checks)
- **Pre-filtering:** `HMGET` during SCAN to check equality predicates before full deserialization
- **Memory efficiency:** Redis ziplist encoding for small entities
- **Type-aware storage:** each field serialized according to its declared column type

### Finding entities

`find()` uses Redis `SCAN` to iterate all keys matching the collection pattern, then filters
in-memory. There are no secondary indexes -- this is a deliberate trade-off for simplicity and
TTL compatibility.

For direct key lookups (`find({ id: "abc" })` where all primary keys are specified), the repository
skips SCAN and does a direct `HGETALL` -- O(1) instead of O(n).

---

## RedisSource

Central factory that manages the ioredis connection and creates repositories and message buses.

```ts
const source = new RedisSource({
  url: "redis://localhost:6379/0",
  config: { /* ioredis RedisOptions */ },
  entities: [Session, User],
  messages: [UserCreatedEvent],
  namespace: "prod",
  logger: myLogger,
});
```

### Connection lifecycle

```ts
await source.connect();     // connect to Redis
await source.setup();       // connect + start delay service if messages registered
await source.ping();        // verify connection (PING/PONG)
await source.disconnect();  // stop services, quit client
```

### Factory methods

```ts
// Entity repository
const repo = source.repository(Session);

// Message bus (publish + subscribe)
const bus = source.messageBus(UserCreatedEvent);

// Publisher only (no subscriptions)
const pub = source.publisher(UserCreatedEvent);

// Clone source (shares connection, override logger)
const cloned = source.clone({ logger: requestLogger });
```

### Runtime registration

```ts
source.addEntities([NewEntity, "./path/to/entities"]);
source.addMessages([NewEvent]);

source.hasEntity(Session);           // true
source.hasMessage(UserCreatedEvent); // true
```

---

## RedisRepository

Full CRUD repository with relation support, optimistic locking, and lifecycle hooks.

### Entity lifecycle

```ts
const repo = source.repository(Session);

const session = repo.create({ userId: "user-123", data: {} });
repo.validate(session);

await repo.insert(session);     // first persistence (throws if exists)
await repo.update(session);     // update with version check
await repo.save(session);       // auto-detects insert vs update
await repo.destroy(session);    // delete with cascade
```

### Query methods

```ts
const sessions = await repo.find({ userId: "user-123" });
const count = await repo.count({ userId: "user-123" });
const exists = await repo.exists({ id: "abc" });

const session = await repo.findOne({ id: "abc" });            // null if missing
const session = await repo.findOneOrFail({ id: "abc" });       // throws if missing
const session = await repo.findOneOrSave({ id: "abc" }, defaults); // upsert

// TTL (seconds until expiry, requires @ExpiryDateColumn)
const seconds = await repo.ttl({ id: "abc" });
```

### Bulk operations

```ts
await repo.insertBulk([s1, s2, s3]);
await repo.saveBulk([s1, s2]);
await repo.updateBulk([s1, s2]);
await repo.destroyBulk([s1, s2]);
await repo.cloneBulk([s1, s2]);
```

### Optimistic locking

Entities with `@VersionColumn` are version-checked on update using `HGET` on just the version
field (single-field read, not full entity fetch). Throws `RedisRepositoryError` on version mismatch.

### TTL

Entities with `@ExpiryDateColumn` automatically get `EXPIRE` set on write. Redis handles
expiration natively -- no cleanup cron needed.

---

## Relations

Relations defined via `@lindorm/entity` decorators are fully supported with the same loading and
cascade semantics as `@lindorm/mongo`.

### Loading strategies

```ts
@OneToMany(() => CartItem, "cart", { loading: "eager" })
public items!: CartItem[];

@ManyToOne(() => User, "carts", { loading: "lazy" })
public user!: User;
```

**Eager:** loaded immediately via parallel `HGETALL` calls after entity fetch.

**Lazy:** returns a `Proxy` that defers loading until `.then()` is accessed. Result is cached
after first access.

### Cascade operations

```ts
@OneToMany(() => CartItem, "cart", {
  onInsert: "cascade",
  onUpdate: "cascade",
  onDestroy: "cascade",
  onOrphan: "delete",
})
public items!: CartItem[];
```

### ManyToMany via Redis SETs

ManyToMany relations use Redis SETs as join tables instead of a separate collection.

**Key pattern:** `{joinCollectionName}.{findKey1}:{value1}` with SET members encoding the
target entity's key columns.

**Bidirectional:** both forward and reverse SETs are maintained, so loading works from either
side of the relation.

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

## Message bus

Redis Streams-based pub/sub with consumer groups and delayed message delivery.

### Publishing

```ts
const pub = source.publisher(UserCreatedEvent);

const event = pub.create({ userId: "user-123", name: "Alice" });
await pub.publish(event);

// Delayed delivery
await pub.publish(event, { delay: 30_000 }); // deliver after 30 seconds
```

### Subscribing

```ts
const bus = source.messageBus(UserCreatedEvent);

bus.subscribe({
  topic: "user.created",
  queue: "email-service",
  callback: async (message) => {
    await sendWelcomeEmail(message.data.userId);
  },
});
```

Messages use Redis consumer groups (`XGROUP`/`XREADGROUP`/`XACK`) for reliable delivery.
Delayed messages are stored in a `ZSET` and polled by an internal delay service.

---

## Multi-tenancy

Entities with `@ScopeColumn` have scope embedded in the Redis key, providing natural tenant
isolation:

```ts
@Entity()
class TenantData extends EntityBase {
  @ScopeColumn()
  public tenantId!: string;

  @Column("string")
  public value!: string;
}
```

Key format: `prod.tenant_data.tenant-123.id:abc-def`

---

## Testing

Mock factories for unit testing without a real Redis connection:

```ts
import {
  createMockRedisSource,
  createMockRedisRepository,
  createMockRedisMessageBus,
  createMockRedisPublisher,
} from "@lindorm/redis";

const source = createMockRedisSource();
const repo = createMockRedisRepository(Session);

// All methods are jest.fn() mocks with sensible defaults
repo.create({ userId: "test" });        // returns entity instance
await repo.find({ userId: "test" });    // returns [entity]
await repo.insert(entity);             // resolves with entity
```

The message bus mock synchronously calls subscription callbacks on `publish()`, making it easy
to test pub/sub flows without Redis.

---

## License

AGPL-3.0-or-later
