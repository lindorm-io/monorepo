# @lindorm-io/koa-mongo

Mongo repository middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-mongo
```

## Usage

### Mongo Connection Middleware

```typescript
import { MongoClient } from "mongodb";
import { MongoConnection } from "@lindorm-io/mongo";

const mongoConnection = new MongoConnection({ ...options });

koaApp.addMiddleware(mongoMiddleware(mongoConnection));

await ctx.connection.mongo.connect();
```

### Repository Middleware

```typescript
koaApp.addMiddleware(
  repositoryMiddleware(YourRepositoryClass, {
    repositoryKey: "key", // OPTIONAL [ string ]
  }),
);

await ctx.repository.yourRepositoryClass.create(yourEntity);
```

### Entity Middleware

```typescript
const middleware = repositoryEntityMiddleware(YourEntityClass, YourRepositoryClass, {
  repositoryKey: "key", // OPTIONAL [ string ]
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
