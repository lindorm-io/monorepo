# @lindorm-io/koa-amqp

AMQP middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-amqp
```

### Peer Dependencies

This package has the following peer dependencies:

- [@lindorm-io/amqp](https://www.npmjs.com/package/@lindorm-io/amqp)
- [@lindorm-io/entity](https://www.npmjs.com/package/@lindorm-io/entity)
- [@lindorm-io/koa](https://www.npmjs.com/package/@lindorm-io/koa)
- [@lindorm-io/winston](https://www.npmjs.com/package/@lindorm-io/winston)

## Usage

### Amqp Connection Middleware

```typescript
import amqp from "amqplib";
import { AmqpConnection } from "@lindorm-io/amqp";

const amqpConnection = new AmqpConnection({ ...options });

koaApp.addMiddleware(amqpMiddleware(amqpConnection));

const amqp: amqp = await ctx.connection.amqp.connect();
```

### Repository Middleware

```typescript
koaApp.addMiddleware(
  messageBusMiddleware(YourMessageBus),
);

await ctx.messageBus.publish([yourMessage]);
```
