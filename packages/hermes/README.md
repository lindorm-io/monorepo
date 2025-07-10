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
| Aggregate | Owns the business state and invariants. Accepts **Commands** and produces **Events**.                       |
| Saga      | Long-running process manager reacting to events and dispatching new commands.                               |
| View      | Projection / read-model updated by events. Can be stored in Mongo, Postgres, Redis or any custom adapter.   |
| Query     | Stateless handler returning data from a view.                                                               |
| Checksum  | Lightweight projection keeping track of aggregate / event checksums.                                        |
| Error     | Handles domain-level errors and publishes them on the message bus.                                          |

All modules and handlers are plain classes so they can be discovered automatically by the scanner or registered manually.

### Module/Handler cheat-sheet

```ts
@Aggregate()
export class ExampleAggregate {

  @AggregateCommandHandler(TestCommandCreate, {
    conditions: { created: false },
    schema: z.object({ input: z.string() }),
  })
  public async onCreate(
    ctx: AggregateCommandCtx<TestCommandCreate, TestAggregateState>,
  ): Promise<void> {
    await ctx.apply(new TestEventCreate("create"));
  }

  @AggregateEventHandler(TestEventCreate)
  public async onCreated(
    ctx: AggregateEventCtx<TestEventCreate, TestAggregateState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @AggregateErrorHandler(DomainError)
  public async onDomainError(ctx: AggregateErrorCtx<DomainError>): Promise<void> {
    ctx.logger.warn("DomainError", {
      command: ctx.command,
      error: ctx.error,
      message: ctx.message,
    });
  }

}

@Saga(ExampleAggregate)
export class ExampleSaga {

  @SagaEventHandler(ExampleEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: SagaEventCtx<ExampleEventCreate, ExampleSagaState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @SagaTimeoutHandler(TestTimeoutMergeState)
  public async onMergeStateTimeout(
    ctx: SagaTimeoutCtx<TestTimeoutMergeState, TestSagaState>,
  ): Promise<void> {
    ctx.mergeState({ mergeStateTimeout: ctx.timeout.input });
  }

  @SagaErrorHandler(DomainError)
  public async onDomainError(ctx: SagaErrorCtx<DomainError>): Promise<void> {
    ctx.logger.warn("DomainError", {
      event: ctx.event,
      error: ctx.error,
      message: ctx.message,
      saga: ctx.saga,
    });
  }

}

@View(ExampleAggregate, "mongo")
export class ExampleMongoView {

  @ViewEventHandler(ExampleEventCreate, { conditions: { created: false } })
  public async onCreateEvent(
    ctx: ViewEventCtx<ExampleEventCreate, ExampleMongoViewState>,
  ): Promise<void> {
    ctx.mergeState({ create: ctx.event.input });
  }

  @ViewQueryHandler(ExampleMongoQuery)
  public async onMongoQuery(
    ctx: ViewQueryCtx<ExampleMongoQuery, ExampleMongoViewState>,
  ): Promise<Dict | undefined> {
    return await ctx.repositories.mongo.findById(ctx.query.id);
  }

}
```

Each handler has a strongly typed `(ctx) => {}` callback function where the
context exposes the relevant domain APIs (`apply`, `mergeState`, `dispatch`,
`repositories`, ...).

---

## Quick start

The simplest way to start your project is to look up the `examples` directory and follow the examples there.

---

## Event emitter helpers

Hermes extends the standard `EventEmitter` so you can react to changes in Sagas
or Views in real-time.  The pattern is `scope.context.name.id` and supports
wildcards:

```ts
hermes.on('saga',            () => { /* any saga changed */ })
hermes.on('saga.namespace',     () => {})
hermes.on('saga.namespace.name', () => {})
hermes.on(`saga.namespace.name.${aggregateId}`, () => {})
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
