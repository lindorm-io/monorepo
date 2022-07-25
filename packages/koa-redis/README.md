# @lindorm-io/koa-redis

Mongo Connection middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-redis
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/entity](https://www.npmjs.com/package/@lindorm-io/entity)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/redis](https://www.npmjs.com/package/@lindorm-io/redis)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

### Redis Connection Middleware

```typescript
import { Redis } from "ioredis";
import { RedisConnection } from "@lindorm-io/redis";

const redisConnection = new RedisConnection({ ...options });

koaApp.addMiddleware(redisMiddleware(redisConnection));

await ctx.connection.redis.connect();
```

### Cache Middleware

```typescript
koaApp.addMiddleware(
  cacheMiddleware(YourCacheClass, {
    cacheKey: "key", // OPTIONAL [ string ]
    expiresInSeconds: 1000, // OPTIONAL [ number ]
  }),
);

await ctx.cache.yourCacheClass.create(yourEntity);
```

### Entity Middleware

```typescript
const middleware = cacheEntityMiddleware(YourEntityClass, YourCacheClass, {
  cacheKey: "key", // OPTIONAL [ string ]
  entityKey: "key", // OPTIONAL [ string ]
});

router.addMiddleware(
  middleware("body.entityName", {
    attributeKey: "name", // OPTIONAL [ string ]
    customValidation: async (context, entity) => {}, // OPTIONAL [ function ]
    optional: false, // OPTIONAL [ boolean ]
  }),
);

ctx.entity.yourEntityClass.id; // -> <uuid>
```
