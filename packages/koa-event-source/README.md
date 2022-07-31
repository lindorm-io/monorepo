# @lindorm-io/koa-event-source

AMQP middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-event-source
```

## Usage

### Amqp Connection Middleware

```typescript
import { EventDomainApp } from "@lindorm-io/event-source";

const app = new EventDomainApp({ ...options });

koaApp.addMiddleware(eventSourceMiddleware(app));

await ctx.eventSource.publish({ ...commandOptions });
```
