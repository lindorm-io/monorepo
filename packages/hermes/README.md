# @lindorm/hermes

Hermes is the event-sourcing and CQRS powerhouse of the Lindorm toolkit.  
It combines Aggregates, Sagas, Views (projections) and Queries with a pluggable
infrastructure layer so you can run the exact same domain-code locally, in a
docker-compose stack or in production Kubernetes—backed by MongoDB, Postgres,
Redis and RabbitMQ.

The philosophy is simple:

* **Emit commands** that are validated and transformed into events.
* **Persist events** in an *Event Store* and publish them on a *Message Bus*.
* **React to events** in Sagas, Checksums and Views.
* **Query projections** instead of aggregates for blazing fast reads.

If you have used Axon, EventFlow or similar frameworks you will feel right at
home – but with first-class TypeScript types, zod validation and no runtime
magic.

---

## Installation

```bash
npm install @lindorm/hermes
# or
yarn add @lindorm/hermes
```

Hermes **does not** bundle any database drivers. Pick the sources you need and
install them separately:

```bash
# Typical docker-compose development stack
npm install @lindorm/mongo     # MongoDB Event / Checksum / Encryption / Saga / View store
npm install @lindorm/postgres  # Postgres   View store
npm install @lindorm/redis     # Redis      View store / Cache
npm install @lindorm/rabbit    # RabbitMQ   Message bus
```

---

## Core building blocks

| Concept   | Purpose                                                                                                     |
|-----------|-------------------------------------------------------------------------------------------------------------|
| Aggregate | Owns the business state and invariants.  Accepts **Commands** and produces **Events**.                      |
| Saga      | Long-running process manager reacting to events and dispatching new commands.                               |
| View      | Projection / read-model updated by events.  Can be stored in Mongo, Postgres, Redis or any custom adapter.  |
| Query     | Stateless handler returning data from a view.                                                               |
| Checksum  | Lightweight projection keeping track of aggregate / event checksums.                                        |
| Error     | Handles domain-level errors and publishes them on the message bus.                                          |

All handlers are plain classes so they can be discovered automatically by the scanner
or registered manually through the **admin** API.

### Handler cheat-sheet

```ts
new HermesAggregateCommandHandler<MyCommand, MyEvent>({...})
new HermesAggregateEventHandler<MyEvent>({...})
new HermesSagaEventHandler<MyEvent>({...})
new HermesViewEventHandler<MyEvent>({...})
new HermesChecksumEventHandler({...})
new HermesErrorHandler<MyError, MyEvent>({...})
new HermesQueryHandler<MyQuery, Result>({...})
```

Each handler accepts a strongly typed `handler: (ctx) => {}` function where the
context exposes the relevant domain APIs (`apply`, `mergeState`, `dispatch`,
`repositories`, …).

---

## Quick start

Below is a **minimal but complete** example distilled from the
`Hermes.integration.ts` test suite.  It demonstrates the full publish / react /
query flow using MongoDB for storage and RabbitMQ for messaging.  Replace the
sources to suit your own environment.

```ts
import {
  Hermes,
  HermesAggregateCommandHandler,
  HermesAggregateEventHandler,
  HermesViewEventHandler,
  HermesQueryHandler,
  ViewStoreType,
} from '@lindorm/hermes';
import { MongoSource } from '@lindorm/mongo';
import { RabbitSource } from '@lindorm/rabbit';
import { Logger } from '@lindorm/logger';
import { z } from 'zod';

// 1. Infrastructure
const logger   = new Logger();
const mongo    = new MongoSource({ url: 'mongodb://root:example@localhost/admin?authSource=admin', logger });
const rabbit   = new RabbitSource({ url: 'amqp://localhost:5672', logger });

await Promise.all([mongo.setup(), rabbit.setup()]);

// 2. Hermes instance
const hermes = new Hermes({
  checksumStore: { mongo },
  encryptionStore: { mongo },
  eventStore: { mongo },
  messageBus: { rabbit },
  sagaStore: { mongo },
  viewStore: { mongo },
  context: 'hermes-example',
  logger,
});

// 3. Domain objects
class CreateGreeting { constructor(public readonly text: string) {} }
class GreetingCreated { constructor(public readonly text: string) {} }
class GetGreeting { constructor(public readonly id: string) {} }

// 4. Command handler (validates and emits event)
await hermes.admin.register.aggregateCommandHandler(
  new HermesAggregateCommandHandler<CreateGreeting, GreetingCreated>({
    commandName: 'create_greeting',
    aggregate: { name: 'greeting', context: 'hermes-example' },
    schema: z.object({ text: z.string().min(1) }),
    handler: async (ctx) => {
      await ctx.apply(new GreetingCreated(ctx.command.text));
    },
  }),
);

// 5. Event handler (updates aggregate state)
await hermes.admin.register.aggregateEventHandler(
  new HermesAggregateEventHandler<GreetingCreated>({
    eventName: 'greeting_created',
    aggregate: { name: 'greeting', context: 'hermes-example' },
    handler: async (ctx) => {
      ctx.mergeState({ text: ctx.event.text });
    },
  }),
);

// 6. View projection (for fast reads)
await hermes.admin.register.viewEventHandler(
  new HermesViewEventHandler<GreetingCreated>({
    eventName: 'greeting_created',
    adapter: { type: ViewStoreType.Mongo },
    aggregate: { name: 'greeting', context: 'hermes-example' },
    view: { name: 'greeting_view', context: 'hermes-example' },
    getViewId: (event) => event.aggregate.id,
    handler: async (ctx) => ctx.setState({ text: ctx.event.text }),
  }),
);

// 7. Query handler
hermes.admin.register.queryHandler(
  new HermesQueryHandler<GetGreeting, any>({
    queryName: 'get_greeting',
    view: { name: 'greeting_view', context: 'hermes-example' },
    handler: (ctx) => ctx.repositories.mongo.findById(ctx.query.id),
  }),
);

// 8. Boot Hermes (scans directories, subscribes to queues, …)
await hermes.setup();

// 9. Publish a command
const aggregateId = '1234';
await hermes.command(new CreateGreeting('Hello world!'), { aggregate: { id: aggregateId } });

// 10. Read the projection
const greeting = await hermes.query(new GetGreeting(aggregateId));
console.log(greeting.state.text); // → "Hello world!"
```

---

## Event emitter helpers

Hermes extends the standard `EventEmitter` so you can react to changes in Sagas
or Views in real-time.  The pattern is `scope.context.name.id` and supports
wildcards:

```ts
hermes.on('saga',            () => { /* any saga changed */ })
hermes.on('saga.my-ctx',     () => {})
hermes.on('saga.my-ctx.foo', () => {})
hermes.on(`saga.my-ctx.foo.${aggregateId}`, () => {})
```

---

## Admin API

The `hermes.admin` facade gives you programmatic access to registration and
inspection utilities.

```ts
await hermes.admin.inspect.aggregate({ id, name: 'greeting' });
await hermes.admin.inspect.saga({ id, name: 'process' });
await hermes.admin.inspect.view({ id, name: 'greeting_view' });
```

---

## Type safety

Hermes is written in strict TypeScript and makes heavy use of generics so that
the compiler knows which command/event/query you are working with at every
step.  All run-time payloads can additionally be validated with `zod` schemas
for maximum resilience.

---

## Contributing

1. Fork the repo and create your branch from `main`.
2. Run `npm ci` at the root and inside `packages/hermes`.
3. Add / fix tests.
4. Submit a pull request – all checks must pass.

---

## License

Distributed under the MIT license. See `LICENSE` for more information.
