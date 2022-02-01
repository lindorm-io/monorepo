# @lindorm-io/redis

Redis and Cache tools lindorm.io packages

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
  winston,
});

await connection.waitForConnection();
const client = connection.client();

await client.set("key", JSON.stringify({ blobify: "data" }));
const data = await client.get("key");
await client.del("key");

await connection.quit();
```

### Lindorm Cache

```typescript
export class TestCache extends LindormCache<TestEntityAttributes, TestEntity> {
  public constructor(options: CacheBaseOptions) {
    super({
      ...options,
      entityName: "TestEntity",
      indexedAttributes: ["name"],
    });
  }

  protected createEntity(data: TestEntityAttributes): TestEntity {
    return new TestEntity(data);
  }
}

const cache = new TestCache({
  client: connection.client(),
  expiresInSeconds: 100,
  logger: winston,
});

await cache.create(entity);
await cache.update(entity);
const entity = await cache.find({ id: "id" });
const array = await cache.findMany({ name: "name" });
await cache.destroy(entity);
```
