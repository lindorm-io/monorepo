# @lindorm-io/koa-keystore

Keystore middleware for @lindorm-io/koa applications.

## Installation

```shell script
npm install --save @lindorm-io/koa-keystore
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/mongo](https://www.npmjs.com/package/@lindorm-io/mongo)
- [@lindorm-io/redis](https://www.npmjs.com/package/@lindorm-io/redis)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

You will need a middleware that sets keys on context. You can add multiple middleware to add multiple key sources. They will flatten to one array. Once you are done, you will need to initialise the keystore. Add this middleware after all keys have been set.

### Keys

Use one or many of these strategies to add keys to context.

#### JWKS

```typescript
koaApp.addMiddleware(jwksKeysMiddleware);
```

#### Repository Keys

```typescript
koaApp.addMiddleware(repositoryMiddleware(KeyPairRepository)); // from koa-mongo
koaApp.addMiddleware(repositoryKeysMiddleware);
```

#### Cached Repository Keys

```typescript
koaApp.addWorker(
  keyPairMongoCacheWorker({
    mongoConnection, // not required if mongoConnectionOptions is set
    mongoConnectionOptions: {
      auth: { user: "root", password: "example" },
      databaseName: "database",
      hostname: "mongo.host",
      port: 27000,
    }, // not required if mongoConnection is set
    resisConnection, // not required if redisConnectionOptions is set
    redisConnectionOptions: {
      port: 1000,
      type: RedisConnectionType.CACHE,
    }, // not required if redisConnection is set
    winston: winstonLogger,
    workerInterval: "1 hours",
  }),
);
koaApp.addMiddleware(cacheMiddleware(KeyPairCache)); // from koa-redis
koaApp.addMiddleware(cacheKeysMiddleware);
```

#### Cached JWKS

```typescript
koaApp.addWorker(
  keyPairJwksCacheWorker({
    baseUrl: "https://authentication.service",
    clientName: "Authentication",
    resisConnection, // not required if redisConnectionOptions is set
    redisConnectionOptions: {
      port: 1000,
      type: RedisConnectionType.CACHE,
    }, // not required if redisConnection is set
    winston: winstonLogger,
    workerInterval: "5 minutes",
  }),
);
koaApp.addMiddleware(cacheMiddleware(KeyPairCache)); // from koa-redis
koaApp.addMiddleware(cacheKeysMiddleware);
```

### Keystore

```typescript
koaApp.addMiddleware(keystoreMiddleware);
```

### Rotation

If you want a worker to handle key rotation automatically, you can let this worker generate keys.

```typescript
koaApp.addWorker(
  keyPairRotationWorker({
    keyType: KeyType.EC, // optional
    mongoConnection, // not required if mongoConnectionOptions is set
    mongoConnectionOptions: {
      auth: { user: "root", password: "example" },
      databaseName: "database",
      hostname: "mongo.host",
      port: 27000,
    }, // not required if mongoConnection is set
    namedCurve: NamedCurve.P521, // optional
    passphrase: "passphrase", // optional
    rotationInterval: "90 days", // optional
    winston: winstonLogger,
    workerInterval: "1 days",
  }),
);
```

### Cleanup

If you're using key-pairs from repository, you should leave a worker running to clean up expired keys.

```typescript
koaApp.addWorker(
  keyPairCleanupWorker({
    mongoConnection, // not required if mongoConnectionOptions is set
    mongoConnectionOptions: {
      auth: { user: "root", password: "example" },
      databaseName: "database",
      hostname: "mongo.host",
      port: 27000,
    }, // not required if mongoConnection is set
    winston: winstonLogger,
    workerInterval: "1 days",
  }),
);
```
