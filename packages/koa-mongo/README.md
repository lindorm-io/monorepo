# @lindorm-io/koa-mongo

Mongo Connection middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-mongo
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/entity](https://www.npmjs.com/package/@lindorm-io/entity)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/mongo](https://www.npmjs.com/package/@lindorm-io/mongo)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

### Mongo Connection Middleware

```typescript
import { MongoClient } from "mongodb";
import { MongoConnection } from "@lindorm-io/mongo";

const mongoConnection = new MongoConnection({ ...options });

koaApp.addMiddleware(mongoMiddleware(mongoConnection));

const client: MongoClient = await ctx.client.mongo.connect();
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
