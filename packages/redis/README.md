# @lindorm-io/redis

Redis cache tools lindorm.io packages

## Installation

```shell script
npm install --save @lindorm-io/redis
```

## Usage

### Redis Connection

```typescript
const connection = new RedisConnection({
  host: "localhost",
  port: 6379,
  logger,
});

await connection.connect();
const client = connection.client;

await client.set("key", JSON.stringify({ blobify: "data" }));
const data = await client.get("key");
await client.del("key");

await connection.disconnect();
```

### Lindorm Cache

```typescript
export class TestCache extends LindormCache<TestEntityAttributes, TestEntity> {
  public constructor(options: CacheBaseOptions) {
    super({
      ...options,
      entityName: "TestEntity",
      indexedAttributes: ["name"],
      ttlAttribute: "expires",
    });
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }
}

const cache = new TestCache({
  connection,
  logger,
});

await cache.create(entity);
await cache.createMany([entity, anotherEntity]);

await cache.deleteMany({ name: "destroy" });
await cache.destroy(entity);
await cache.destroyMany([entity, anotherEntity]);

await cache.find({ id: "id" });
await cache.findMany({ name: "name" });

await cache.findOrCreate({ name: "name" });
await cache.tryFind({ name: "name" });

await cache.ttl(entity);

await cache.update(entity);
await cache.updateMany([entity, anotherEntity]);
```
