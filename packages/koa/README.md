# @lindorm-io/koa

Koa App & Router for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/koa
```

## Usage

### KoaApp

```typescript
const app = new KoaApp({
  logger: winstonLogger,
  port: 3000,
});

app.addMiddleware(basicAuthMiddleware);

app.addRoute("/route", router);

app.addWorker(intervalWorker);

await app.start();
```

### IntervalWorker

```typescript
const intervalWorker = new IntervalWorker({
  callback: Promise.resolve(),
  time: 5000,
  logger: winstonLogger,
});
```
