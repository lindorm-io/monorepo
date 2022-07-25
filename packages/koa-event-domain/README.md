# @lindorm-io/koa-event-domain

AMQP middleware for @lindorm-io/koa applications

## Installation

```shell script
npm install --save @lindorm-io/koa-event-domain
```

## Usage

### Amqp Connection Middleware

```typescript
import { EventDomainApp } from "@lindorm-io/event-domain";

const app = new EventDomainApp({ ...options });

koaApp.addMiddleware(eventDomainMiddleware(app));

await ctx.eventDomain.publish({ ...commandOptions });
```
