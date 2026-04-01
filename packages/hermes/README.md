# @lindorm/hermes

Hermes is a decorator-driven **CQRS + Event Sourcing** framework for TypeScript.
It combines Aggregates, Sagas (process managers), Views (projections) and Queries
with a pluggable infrastructure layer so the same domain code runs locally with
in-memory drivers, in docker-compose, or in production Kubernetes backed by
Postgres, MongoDB, Redis and RabbitMQ.

The philosophy is simple:

1. **Commands** are validated, then handled by an Aggregate.
2. The Aggregate **applies Events** that mutate its state.
3. Events are **persisted** in an Event Store and **published** on a Message Bus.
4. **Sagas** react to events, dispatch new commands and schedule timeouts.
5. **Views** project events into read-optimised entities.
6. **Queries** read from views for fast, scalable reads.

---

## Installation

```bash
npm install @lindorm/hermes
```

Hermes does not bundle database or messaging drivers. Install them separately:

```bash
npm install @lindorm/proteus   # persistence (event store, views, sagas)
npm install @lindorm/iris      # messaging (command bus, event bus)
npm install @lindorm/logger    # structured logging
```

For production you also need the concrete Proteus and Iris drivers for your
infrastructure (e.g. `@lindorm/postgres`, `@lindorm/mongo`, `@lindorm/rabbit`).
For local development the built-in memory drivers work out of the box.

---

## Table of contents

- [Core concepts](#core-concepts)
- [Quick start](#quick-start)
- [Module discovery](#module-discovery)
- [Defining Commands](#defining-commands)
- [Defining Events](#defining-events)
- [Defining an Aggregate](#defining-an-aggregate)
- [Defining a Saga](#defining-a-saga)
- [Defining a View](#defining-a-view)
- [Defining Queries](#defining-queries)
- [Defining Timeouts](#defining-timeouts)
- [Event Upcasting (schema evolution)](#event-upcasting-schema-evolution)
- [Validation with Zod](#validation-with-zod)
- [Lifecycle guards](#lifecycle-guards)
- [Error handling](#error-handling)
- [Setting up Hermes](#setting-up-hermes)
- [Dispatching commands](#dispatching-commands)
- [Querying views](#querying-views)
- [Event emitter](#event-emitter)
- [Admin API](#admin-api)
- [Decorator reference](#decorator-reference)
- [Context reference](#context-reference)
- [Type reference](#type-reference)
- [Error reference](#error-reference)

---

## Core concepts

| Concept   | Purpose                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| Aggregate | Owns business state and invariants. Accepts **Commands**, produces **Events**.           |
| Saga      | Long-running process manager. Reacts to events, dispatches commands, schedules timeouts. |
| View      | Read-model / projection updated by events. Backed by a Proteus entity.                   |
| Query     | Stateless handler that reads from a view's repository.                                   |
| Timeout   | Delayed message dispatched by a saga, processed later.                                   |

All modules are plain classes decorated with Hermes decorators. They are
discovered automatically by the scanner or registered manually.

---

## Quick start

```ts
import { Hermes } from "@lindorm/hermes";
import { ProteusSource } from "@lindorm/proteus";
import { IrisSource } from "@lindorm/iris";

const proteus = new ProteusSource({ driver: "memory", logger });
const iris = new IrisSource({ driver: "memory", logger });

const hermes = new Hermes({
  proteus,
  iris,
  modules: [AccountAggregate, OverdraftProtectionSaga, AccountSummaryProjection],
  logger,
  namespace: "banking",
});

await hermes.setup();

// Issue a command (creates a new aggregate)
const { id } = await hermes.command(new OpenAccount("Alice", "USD", 500));

// Issue a command against an existing aggregate
await hermes.command(new DepositFunds(200, "USD"), { id });

// Query a view
const summary = await hermes.query<AccountSummaryView>(new GetAccountSummary(id));

await hermes.teardown();
```

For a comprehensive runnable example covering all features (CQRS flow, sagas,
views, queries, upcasting, event emitter, admin inspect, error handling), run:

```bash
cd packages/hermes
npm run example
```

The example source lives in `src/banking-example.test.ts` with module
definitions in `example/modules/`.

---

## Module discovery

Hermes automatically discovers all your commands, events, aggregates, sagas,
views, queries and timeouts. Just point it at a directory and it recursively
scans every file, reads the decorator metadata, and wires everything together.

```ts
const hermes = new Hermes({
  proteus,
  iris,
  logger,
  modules: [path.resolve(__dirname, "modules")],
});
```

Given a directory structure like this:

```
modules/
├── commands/
│   ├── OpenAccount.ts
│   ├── DepositFunds.ts
│   └── WithdrawFunds.ts
├── events/
│   ├── AccountOpened.ts
│   ├── FundsDeposited_V1.ts
│   └── FundsDeposited_V2.ts
├── aggregates/
│   └── AccountAggregate.ts
├── sagas/
│   └── OverdraftProtectionSaga.ts
├── views/
│   ├── AccountSummaryView.ts
│   └── AccountSummaryProjection.ts
├── timeouts/
│   └── InactivityTimeout.ts
└── queries/
    └── GetAccountSummary.ts
```

Hermes will find every decorated class automatically. The directory structure is
purely organisational — Hermes doesn't care about folder names. A flat directory
with all files in one place works just as well.

The scanner skips files with `test`, `spec`, `fixture`, or `integration` in
their name, and ignores `index` files.

You can also mix directory paths and explicit class references:

```ts
modules: [
  path.resolve(__dirname, "modules"),  // scan a directory
  SomeOtherAggregate,                  // add a class directly
],
```

### How wiring works

During `setup()`, Hermes reads the decorator metadata from every discovered
class to understand the relationships:

- `@Command()`, `@Event()`, `@Query()`, `@Timeout()` register DTO classes
- `@Aggregate()` registers command and event handlers
- `@Saga(AggregateClass)` binds to one or more aggregates
- `@View(AggregateClass, EntityClass)` binds to aggregates **and** captures the
  view entity class — Hermes automatically registers it with the Proteus source

This means you never need to manually register view entities with Proteus.
The `@View` decorator is the single point of connection between your projection
logic, the aggregate it listens to, and the Proteus entity it persists to.

---

## Defining Commands

Commands are simple DTOs decorated with `@Command()`. They carry the intent to
do something. The class name determines the command name and version
automatically (or you can override them).

```ts
import { z } from "zod";
import { Command } from "@lindorm/hermes";

@Command()
export class OpenAccount {
  public constructor(
    public readonly ownerName: string,
    public readonly currency: string,
    public readonly initialDeposit: number,
  ) {}
}

// Optional: Zod schema for runtime validation
export const OpenAccountSchema = z.object({
  ownerName: z.string().min(1),
  currency: z.string().length(3),
  initialDeposit: z.number().nonnegative(),
});
```

Commands with no payload are also valid:

```ts
@Command()
export class CloseAccount {}
```

---

## Defining Events

Events are immutable facts that have happened. Like commands, they are DTOs
decorated with `@Event()`.

```ts
import { Event } from "@lindorm/hermes";

@Event()
export class AccountOpened {
  public constructor(
    public readonly ownerName: string,
    public readonly currency: string,
    public readonly initialBalance: number,
  ) {}
}

@Event()
export class FundsWithdrawn {
  public constructor(public readonly amount: number) {}
}
```

When evolving event schemas over time, use versioned class names
(`FundsDeposited_V1`, `FundsDeposited_V2`) together with
[@EventUpcaster](#event-upcasting-schema-evolution).

---

## Defining an Aggregate

An Aggregate is the core domain object. It receives commands, enforces business
rules, and applies events that mutate its state.

```ts
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateEventHandler,
  AggregateErrorHandler,
  EventUpcaster,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  Validate,
  DomainError,
} from "@lindorm/hermes";
import type {
  AggregateCommandCtx,
  AggregateEventCtx,
  AggregateErrorCtx,
} from "@lindorm/hermes";

type AccountState = {
  ownerName: string;
  currency: string;
  balance: number;
  status: "open" | "closed" | "flagged";
  transactionCount: number;
};

@Aggregate()
@Namespace("banking")
export class AccountAggregate {
  // -- Command handlers --

  @AggregateCommandHandler(OpenAccount)
  @RequireNotCreated()
  @Validate(OpenAccountSchema)
  async onOpenAccount(
    ctx: AggregateCommandCtx<OpenAccount, AccountState>,
  ): Promise<void> {
    await ctx.apply(
      new AccountOpened(
        ctx.command.ownerName,
        ctx.command.currency,
        ctx.command.initialDeposit,
      ),
    );
  }

  @AggregateCommandHandler(DepositFunds)
  @RequireCreated()
  @Validate(DepositFundsSchema)
  async onDepositFunds(
    ctx: AggregateCommandCtx<DepositFunds, AccountState>,
  ): Promise<void> {
    await ctx.apply(new FundsDeposited_V2(ctx.command.amount, ctx.command.currency));
  }

  @AggregateCommandHandler(WithdrawFunds)
  @RequireCreated()
  @Validate(WithdrawFundsSchema)
  async onWithdrawFunds(
    ctx: AggregateCommandCtx<WithdrawFunds, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance < ctx.command.amount) {
      throw new DomainError("Insufficient funds", {
        data: { balance: ctx.state.balance, requested: ctx.command.amount },
      });
    }
    await ctx.apply(new FundsWithdrawn(ctx.command.amount));
  }

  @AggregateCommandHandler(CloseAccount)
  @RequireCreated()
  async onCloseAccount(
    ctx: AggregateCommandCtx<CloseAccount, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance !== 0) {
      throw new DomainError("Cannot close account with non-zero balance", {
        data: { balance: ctx.state.balance },
      });
    }
    await ctx.apply(new AccountClosed());
  }

  // -- Event handlers (state mutations) --

  @AggregateEventHandler(AccountOpened)
  async onAccountOpened(
    ctx: AggregateEventCtx<AccountOpened, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      ownerName: ctx.event.ownerName,
      currency: ctx.event.currency,
      balance: ctx.event.initialBalance,
      status: "open",
      transactionCount: ctx.event.initialBalance > 0 ? 1 : 0,
    });
  }

  @AggregateEventHandler(FundsDeposited_V2)
  async onFundsDeposited(
    ctx: AggregateEventCtx<FundsDeposited_V2, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance + ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(FundsWithdrawn)
  async onFundsWithdrawn(
    ctx: AggregateEventCtx<FundsWithdrawn, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance - ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @AggregateEventHandler(AccountClosed)
  async onAccountClosed(
    ctx: AggregateEventCtx<AccountClosed, AccountState>,
  ): Promise<void> {
    ctx.mergeState({ status: "closed" });
    ctx.destroy();
  }

  // -- Event upcaster --

  @EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)
  upcastFundsDepositedV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
    return new FundsDeposited_V2(event.amount, "USD");
  }

  // -- Error handler --

  @AggregateErrorHandler(DomainError)
  async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
    ctx.logger.warn("Aggregate domain error", { error: ctx.error.message });
  }
}
```

### Aggregate command handler context

The `AggregateCommandCtx<C, S>` gives you:

| Property           | Description                            |
| ------------------ | -------------------------------------- |
| `ctx.command`      | The command instance (typed as `C`)    |
| `ctx.state`        | Current aggregate state (typed as `S`) |
| `ctx.logger`       | Scoped logger                          |
| `ctx.meta`         | Command metadata                       |
| `ctx.apply(event)` | Apply an event to the aggregate        |

### Aggregate event handler context

The `AggregateEventCtx<E, S>` gives you:

| Property                  | Description                                  |
| ------------------------- | -------------------------------------------- |
| `ctx.event`               | The event instance (typed as `E`)            |
| `ctx.state`               | Current aggregate state (typed as `S`)       |
| `ctx.logger`              | Scoped logger                                |
| `ctx.mergeState(partial)` | Shallow-merge partial state                  |
| `ctx.setState(state)`     | Replace entire state                         |
| `ctx.destroy()`           | Mark aggregate as destroyed                  |
| `ctx.destroyNext()`       | Mark aggregate as destroyed after this event |

---

## Defining a Saga

A Saga is a long-running process manager that reacts to events and coordinates
cross-aggregate workflows by dispatching commands and scheduling timeouts.

```ts
import {
  Saga,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
  SagaErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
  SagaErrorCtx,
} from "@lindorm/hermes";

type OverdraftProtectionState = {
  ownerName: string;
  balance: number;
  lowBalanceWarning: boolean;
  lastActivityAt: string;
};

@Saga(AccountAggregate)
@Namespace("banking")
export class OverdraftProtectionSaga {
  @SagaEventHandler(AccountOpened)
  @RequireNotCreated()
  async onAccountOpened(
    ctx: SagaEventCtx<AccountOpened, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.mergeState({
      ownerName: ctx.event.ownerName,
      balance: ctx.event.initialBalance,
      lowBalanceWarning: ctx.event.initialBalance < 100,
      lastActivityAt: new Date().toISOString(),
    });

    // Schedule a timeout (fires after 30 seconds)
    ctx.timeout("inactivity_check", { accountId: ctx.aggregate.id }, 30_000);
  }

  @SagaEventHandler(FundsWithdrawn)
  @RequireCreated()
  async onFundsWithdrawn(
    ctx: SagaEventCtx<FundsWithdrawn, OverdraftProtectionState>,
  ): Promise<void> {
    const newBalance = ctx.state.balance - ctx.event.amount;
    ctx.mergeState({ balance: newBalance });

    if (newBalance < 100) {
      // Dispatch a command to another (or the same) aggregate
      ctx.dispatch(new FlagAccount(`Balance dropped below threshold: ${newBalance}`), {
        id: ctx.aggregate.id,
      });
    }
  }

  @SagaEventHandler(AccountClosed)
  @RequireCreated()
  async onAccountClosed(
    ctx: SagaEventCtx<AccountClosed, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.destroy();
  }

  // Resolve the saga ID from an event (required for all events)
  @SagaIdHandler(AccountOpened)
  resolveId(ctx: SagaIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  // Handle scheduled timeouts
  @SagaTimeoutHandler(InactivityTimeout)
  async onInactivityTimeout(
    ctx: SagaTimeoutCtx<InactivityTimeout, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.logger.info("Inactivity timeout fired", {
      accountId: ctx.event.accountId,
    });
    // Re-schedule for continuous monitoring
    ctx.timeout("inactivity_check", { accountId: ctx.event.accountId }, 30_000);
  }

  @SagaErrorHandler(DomainError)
  async onDomainError(ctx: SagaErrorCtx): Promise<void> {
    ctx.logger.warn("Saga domain error", { error: ctx.error.message });
  }
}
```

### Saga event handler context

The `SagaEventCtx<E, S>` gives you:

| Property                           | Description                                             |
| ---------------------------------- | ------------------------------------------------------- |
| `ctx.event`                        | The event instance (typed as `E`)                       |
| `ctx.state`                        | Current saga state (typed as `S`)                       |
| `ctx.aggregate`                    | The source aggregate identity `{ id, name, namespace }` |
| `ctx.logger`                       | Scoped logger                                           |
| `ctx.meta`                         | Event metadata                                          |
| `ctx.mergeState(partial)`          | Shallow-merge partial state                             |
| `ctx.setState(state)`              | Replace entire state                                    |
| `ctx.destroy()`                    | Mark saga as destroyed                                  |
| `ctx.dispatch(command, opts?)`     | Dispatch a command                                      |
| `ctx.timeout(name, data, delayMs)` | Schedule a timeout                                      |

---

## Defining a View

A View is a read-model (projection) that materialises events into a queryable
entity. Views use Proteus entities for persistence.

### Step 1: Define the view entity

```ts
import { Entity, Namespace, Field, Index, Default } from "@lindorm/proteus";
import { HermesViewEntity } from "@lindorm/hermes";

@Entity({ name: "account_summary" })
@Namespace("banking")
export class AccountSummaryView extends HermesViewEntity {
  @Field("string")
  @Index()
  @Default("")
  ownerName: string = "";

  @Field("string")
  @Default("USD")
  currency: string = "USD";

  @Field("float")
  @Default(0)
  balance: number = 0;

  @Field("string")
  @Index()
  @Default("open")
  status: string = "open";

  @Field("integer")
  @Default(0)
  transactionCount: number = 0;
}
```

`HermesViewEntity` extends the Proteus base entity and provides `id`,
`destroyed`, `revision`, `createdAt`, and `updatedAt` fields automatically.

### Step 2: Define the view projection

```ts
import {
  View,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
  ViewErrorHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
  ViewErrorCtx,
} from "@lindorm/hermes";

@View(AccountAggregate, AccountSummaryView)
@Namespace("banking")
export class AccountSummaryProjection {
  @ViewEventHandler(AccountOpened)
  @RequireNotCreated()
  async onAccountOpened(
    ctx: ViewEventCtx<AccountOpened, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.ownerName = ctx.event.ownerName;
    ctx.entity.currency = ctx.event.currency;
    ctx.entity.balance = ctx.event.initialBalance;
    ctx.entity.status = "open";
    ctx.entity.transactionCount = ctx.event.initialBalance > 0 ? 1 : 0;
  }

  @ViewEventHandler(FundsDeposited_V2)
  @RequireCreated()
  async onFundsDeposited(
    ctx: ViewEventCtx<FundsDeposited_V2, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance += ctx.event.amount;
    ctx.entity.transactionCount += 1;
  }

  @ViewEventHandler(AccountClosed)
  @RequireCreated()
  async onAccountClosed(
    ctx: ViewEventCtx<AccountClosed, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.status = "closed";
    ctx.destroy();
  }

  @ViewIdHandler(AccountOpened)
  resolveId(ctx: ViewIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  @ViewQueryHandler(GetAccountSummary)
  async onGetAccountSummary(
    ctx: ViewQueryCtx<GetAccountSummary, AccountSummaryView>,
  ): Promise<AccountSummaryView | null> {
    return ctx.repository.findOne({ id: ctx.query.accountId });
  }

  @ViewErrorHandler(DomainError)
  onDomainError(ctx: ViewErrorCtx<AccountSummaryView>): void {
    ctx.logger.warn("View domain error", { error: ctx.error.message });
  }
}
```

Views use **direct entity mutation** (`ctx.entity.balance += amount`) rather than
`mergeState`. The entity is automatically persisted after each handler
invocation.

### View event handler context

| Property        | Description                                                |
| --------------- | ---------------------------------------------------------- |
| `ctx.event`     | The event instance (typed as `E`)                          |
| `ctx.entity`    | The view entity instance (typed as `V`) -- mutate directly |
| `ctx.logger`    | Scoped logger                                              |
| `ctx.meta`      | Event metadata                                             |
| `ctx.destroy()` | Mark view entity as destroyed                              |

### View query handler context

| Property         | Description                                 |
| ---------------- | ------------------------------------------- |
| `ctx.query`      | The query instance (typed as `Q`)           |
| `ctx.logger`     | Scoped logger                               |
| `ctx.repository` | `IProteusRepository<V>` for the view entity |

---

## Defining Queries

Queries are simple DTOs that carry read parameters:

```ts
import { Query } from "@lindorm/hermes";

@Query()
export class GetAccountSummary {
  public constructor(public readonly accountId: string) {}
}
```

Queries are handled by `@ViewQueryHandler` methods on view classes.

---

## Defining Timeouts

Timeouts are DTOs scheduled by sagas for delayed processing:

```ts
import { Timeout } from "@lindorm/hermes";

@Timeout()
export class InactivityTimeout {
  public constructor(public readonly accountId: string) {}
}
```

Timeouts are dispatched from saga handlers via `ctx.timeout(name, data, delayMs)`
and handled by `@SagaTimeoutHandler` methods.

---

## Event Upcasting (schema evolution)

When an event schema changes, old events in the store need to be read with the
new schema. Hermes solves this with `@EventUpcaster` decorators that
transparently transform old event versions to new ones at load time. The
original events in the store are never modified.

```ts
// V1: original event (amount only)
@Event()
export class FundsDeposited_V1 {
  public constructor(public readonly amount: number) {}
}

// V2: new event (amount + currency)
@Event()
export class FundsDeposited_V2 {
  public constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}
```

Register the upcaster on the aggregate:

```ts
@EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)
upcastFundsDepositedV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
  return new FundsDeposited_V2(event.amount, "USD");
}
```

Upcasters can be chained: V1 -> V2 -> V3. Hermes resolves the full chain
automatically.

---

## Validation with Zod

Use `@Validate(schema)` on command handlers to validate payloads at runtime
before the handler executes:

```ts
import { z } from "zod";

const DepositFundsSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1),
});

@AggregateCommandHandler(DepositFunds)
@RequireCreated()
@Validate(DepositFundsSchema)
async onDepositFunds(ctx: AggregateCommandCtx<DepositFunds, AccountState>): Promise<void> {
  await ctx.apply(new FundsDeposited_V2(ctx.command.amount, ctx.command.currency));
}
```

If validation fails, a `CommandSchemaValidationError` is thrown (permanent, not
retried).

---

## Lifecycle guards

Use `@RequireCreated()` and `@RequireNotCreated()` to enforce aggregate/saga/view
lifecycle constraints:

```ts
@AggregateCommandHandler(OpenAccount)
@RequireNotCreated()   // fails if aggregate already exists
async onOpenAccount(ctx) { ... }

@AggregateCommandHandler(DepositFunds)
@RequireCreated()      // fails if aggregate doesn't exist yet
async onDepositFunds(ctx) { ... }
```

These work on aggregate command handlers, saga event handlers, and view event
handlers.

---

## Error handling

Domain errors are handled by dedicated error handlers on each domain type:

```ts
@AggregateErrorHandler(DomainError)
async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
  ctx.logger.warn("Domain error occurred", { error: ctx.error.message });
}

@SagaErrorHandler(DomainError)
async onSagaError(ctx: SagaErrorCtx): Promise<void> {
  // Can dispatch compensating commands
  ctx.dispatch(new CompensateCommand(), { id: ctx.aggregate.id });
}

@ViewErrorHandler(DomainError)
onViewError(ctx: ViewErrorCtx<AccountSummaryView>): void {
  ctx.logger.warn("View error", { error: ctx.error.message });
}
```

`DomainError` supports a `permanent` flag. Permanent errors are never retried;
transient errors are retried automatically by the infrastructure.

---

## Setting up Hermes

```ts
import { Hermes } from "@lindorm/hermes";
import { ProteusSource } from "@lindorm/proteus";
import { IrisSource } from "@lindorm/iris";

const hermes = new Hermes({
  // Required: persistence source (event store, saga store, view store)
  proteus: new ProteusSource({ driver: "memory", logger }),

  // Optional: additional view sources (for views stored in different databases)
  viewSources: [new ProteusSource({ driver: "postgres", url: "...", logger })],

  // Required: messaging source (command bus, event bus)
  iris: new IrisSource({ driver: "memory", logger }),

  // Required: module classes or glob patterns
  modules: [AccountAggregate, OverdraftProtectionSaga, AccountSummaryProjection],

  // Required: logger
  logger,

  // Optional: default namespace for all modules
  namespace: "banking",

  // Optional: encryption config for @Forgettable fields
  encryption: {
    algorithm: "aes-256-gcm",
  },

  // Optional: checksum mode ("strict" throws, "warn" logs)
  checksumMode: "strict",

  // Optional: how long causation records are kept
  causationExpiry: "7d",
});

await hermes.setup();
// ... use hermes ...
await hermes.teardown();
```

### HermesOptions

| Option            | Type                      | Required | Description                              |
| ----------------- | ------------------------- | -------- | ---------------------------------------- |
| `proteus`         | `ProteusSource`           | yes      | Primary persistence source               |
| `viewSources`     | `ProteusSource[]`         | no       | Additional sources for views             |
| `iris`            | `IIrisSource`             | yes      | Messaging source                         |
| `modules`         | `ClassLike[] \| string[]` | yes      | Module classes or glob paths             |
| `logger`          | `ILogger`                 | yes      | Logger instance                          |
| `namespace`       | `string`                  | no       | Default namespace                        |
| `encryption`      | `object`                  | no       | Encryption settings for forgettable data |
| `checksumMode`    | `"strict" \| "warn"`      | no       | Checksum validation mode                 |
| `causationExpiry` | `ReadableTime`            | no       | Causation record TTL                     |

### Lifecycle

| Method                      | Description                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------- |
| `hermes.setup()`            | Scans modules, builds registry, initialises stores, starts message consumers          |
| `hermes.teardown()`         | Stops all consumers and closes connections                                            |
| `hermes.clone({ logger? })` | Creates a new Hermes instance sharing internal state (useful for per-request loggers) |
| `hermes.status`             | Returns `"created" \| "initialising" \| "ready" \| "stopping" \| "stopped"`           |

---

## Dispatching commands

```ts
// Create a new aggregate (Hermes generates the ID)
const { id, name, namespace } = await hermes.command(
  new OpenAccount("Alice", "USD", 500),
);

// Target an existing aggregate by ID
await hermes.command(new DepositFunds(200, "USD"), { id });

// With options
await hermes.command(new DepositFunds(100, "USD"), {
  id,
  correlationId: "tx-123", // correlation tracking
  delay: 5000, // delayed delivery (ms)
  meta: { source: "api" }, // arbitrary metadata
});
```

`hermes.command()` returns an `AggregateIdentifier`:

```ts
type AggregateIdentifier = {
  id: string;
  name: string;
  namespace: string;
};
```

---

## Querying views

```ts
const summary = await hermes.query<AccountSummaryView>(new GetAccountSummary(accountId));
```

The return type is determined by the generic parameter and whatever the
`@ViewQueryHandler` method returns.

---

## Event emitter

Hermes exposes an event emitter for real-time change notifications. The
pattern is `scope.namespace.name.id` with progressive specificity:

```ts
// Any saga changed
hermes.on("saga", (data) => { ... });

// Any saga in the "banking" namespace
hermes.on("saga.banking", (data) => { ... });

// A specific saga type
hermes.on("saga.banking.overdraft_protection", (data) => { ... });

// A specific saga instance
hermes.on(`saga.banking.overdraft_protection.${id}`, (data) => { ... });
```

Use `hermes.off(event, callback)` to unsubscribe.

---

## Admin API

The `hermes.admin` facade provides inspection, maintenance and replay tools.

### Inspect

```ts
// Load full aggregate state (replays all events)
const aggregate = await hermes.admin.inspect.aggregate<AccountState>({
  id: "...",
  name: "account_aggregate",
  namespace: "banking",
});
// => { id, name, namespace, destroyed, events, numberOfLoadedEvents, state }

// Load saga state
const saga = await hermes.admin.inspect.saga<OverdraftProtectionState>({
  id: "...",
  name: "overdraft_protection",
  namespace: "banking",
});
// => { id, name, namespace, destroyed, revision, state, ... } | null

// Load a view entity
const view = await hermes.admin.inspect.view<AccountSummaryView>({
  id: "...",
  entity: AccountSummaryView,
});
// => AccountSummaryView | null
```

### Replay

Rebuild views or re-process aggregate events from the event store:

```ts
const handle = hermes.admin.replay.view(AccountSummaryView, {
  strategy: "truncate", // wipe existing data first
});

handle.on("progress", (p: ReplayProgress) => {
  console.log(`${p.phase}: ${p.percent}% (${p.processed}/${p.total})`);
});

handle.on("complete", () => console.log("Replay finished"));
handle.on("error", (err) => console.error(err));

// Await completion
await handle.promise;

// Or cancel early
handle.cancel();
```

### Maintenance

```ts
// Purge expired causation records
const removed = await hermes.admin.purgeCausations();
```

---

## Decorator reference

### DTO decorators (class-level)

| Decorator                   | Target | Description                  |
| --------------------------- | ------ | ---------------------------- |
| `@Command(name?, version?)` | class  | Marks class as a command DTO |
| `@Event(name?, version?)`   | class  | Marks class as an event DTO  |
| `@Query(name?)`             | class  | Marks class as a query DTO   |
| `@Timeout(name?, version?)` | class  | Marks class as a timeout DTO |

### Domain decorators (class-level)

| Decorator                                                | Target | Description                                             |
| -------------------------------------------------------- | ------ | ------------------------------------------------------- |
| `@Aggregate(name?)`                                      | class  | Marks class as an aggregate handler                     |
| `@Saga(AggregateClass \| AggregateClass[])`              | class  | Marks class as a saga, bound to aggregate(s)            |
| `@View(AggregateClass \| AggregateClass[], EntityClass)` | class  | Marks class as a view, bound to aggregate(s) and entity |

### Composable decorators (class-level)

| Decorator            | Target | Description                                           |
| -------------------- | ------ | ----------------------------------------------------- |
| `@Namespace(string)` | class  | Scopes the handler to a namespace                     |
| `@Forgettable()`     | class  | Marks class as supporting GDPR-style event forgetting |

### Handler decorators (method-level)

| Decorator                                | Target | Description                                       |
| ---------------------------------------- | ------ | ------------------------------------------------- |
| `@AggregateCommandHandler(CommandClass)` | method | Handles a command on an aggregate                 |
| `@AggregateEventHandler(EventClass)`     | method | Handles an event on an aggregate (state mutation) |
| `@AggregateErrorHandler(ErrorClass)`     | method | Handles errors on an aggregate                    |
| `@EventUpcaster(FromClass, ToClass)`     | method | Transforms old event version to new one           |
| `@SagaEventHandler(EventClass)`          | method | Handles an event on a saga                        |
| `@SagaIdHandler(EventClass)`             | method | Resolves saga ID from an event                    |
| `@SagaTimeoutHandler(TimeoutClass)`      | method | Handles a timeout on a saga                       |
| `@SagaErrorHandler(ErrorClass)`          | method | Handles errors on a saga                          |
| `@ViewEventHandler(EventClass)`          | method | Handles an event on a view                        |
| `@ViewIdHandler(EventClass)`             | method | Resolves view ID from an event                    |
| `@ViewQueryHandler(QueryClass)`          | method | Handles a query on a view                         |
| `@ViewErrorHandler(ErrorClass)`          | method | Handles errors on a view                          |

### Guard decorators (method-level)

| Decorator              | Target | Description                                   |
| ---------------------- | ------ | --------------------------------------------- |
| `@RequireCreated()`    | method | Handler only runs if entity exists            |
| `@RequireNotCreated()` | method | Handler only runs if entity does not exist    |
| `@Validate(zodSchema)` | method | Validates command payload before handler runs |

---

## Context reference

### Aggregate contexts

**`AggregateCommandCtx<C, S>`** -- passed to `@AggregateCommandHandler` methods

| Property       | Type                       | Description             |
| -------------- | -------------------------- | ----------------------- |
| `command`      | `C`                        | Command instance        |
| `state`        | `S`                        | Current aggregate state |
| `logger`       | `ILogger`                  | Scoped logger           |
| `meta`         | `Dict`                     | Command metadata        |
| `apply(event)` | `(event) => Promise<void>` | Apply an event          |

**`AggregateEventCtx<E, S>`** -- passed to `@AggregateEventHandler` methods

| Property              | Type                   | Description                 |
| --------------------- | ---------------------- | --------------------------- |
| `event`               | `E`                    | Event instance              |
| `state`               | `S`                    | Current aggregate state     |
| `logger`              | `ILogger`              | Scoped logger               |
| `meta`                | `Dict`                 | Event metadata              |
| `mergeState(partial)` | `(Partial<S>) => void` | Shallow-merge state         |
| `setState(state)`     | `(S) => void`          | Replace entire state        |
| `destroy()`           | `() => void`           | Mark aggregate as destroyed |
| `destroyNext()`       | `() => void`           | Destroy after this event    |

**`AggregateErrorCtx`** -- passed to `@AggregateErrorHandler` methods

| Property                   | Type      | Description                     |
| -------------------------- | --------- | ------------------------------- |
| `error`                    | `Error`   | The error                       |
| `logger`                   | `ILogger` | Scoped logger                   |
| `dispatch(command, opts?)` | function  | Dispatch a compensating command |

### Saga contexts

**`SagaEventCtx<E, S>`** -- passed to `@SagaEventHandler` methods

| Property                       | Type                   | Description               |
| ------------------------------ | ---------------------- | ------------------------- |
| `event`                        | `E`                    | Event instance            |
| `state`                        | `S`                    | Current saga state        |
| `aggregate`                    | `AggregateIdentifier`  | Source aggregate identity |
| `logger`                       | `ILogger`              | Scoped logger             |
| `meta`                         | `Dict`                 | Event metadata            |
| `mergeState(partial)`          | `(Partial<S>) => void` | Shallow-merge state       |
| `setState(state)`              | `(S) => void`          | Replace entire state      |
| `destroy()`                    | `() => void`           | Mark saga as destroyed    |
| `dispatch(command, opts?)`     | function               | Dispatch a command        |
| `timeout(name, data, delayMs)` | function               | Schedule a timeout        |

**`SagaIdCtx<E>`** -- passed to `@SagaIdHandler` methods

| Property    | Type                  | Description               |
| ----------- | --------------------- | ------------------------- |
| `event`     | `E`                   | Event instance            |
| `aggregate` | `AggregateIdentifier` | Source aggregate identity |
| `logger`    | `ILogger`             | Scoped logger             |

**`SagaTimeoutCtx<E, S>`** -- passed to `@SagaTimeoutHandler` methods

Same shape as `SagaEventCtx<E, S>`.

**`SagaErrorCtx`** -- passed to `@SagaErrorHandler` methods

| Property                   | Type      | Description                     |
| -------------------------- | --------- | ------------------------------- |
| `error`                    | `Error`   | The error                       |
| `logger`                   | `ILogger` | Scoped logger                   |
| `dispatch(command, opts?)` | function  | Dispatch a compensating command |

### View contexts

**`ViewEventCtx<E, V>`** -- passed to `@ViewEventHandler` methods

| Property    | Type         | Description                            |
| ----------- | ------------ | -------------------------------------- |
| `event`     | `E`          | Event instance                         |
| `entity`    | `V`          | View entity instance (mutate directly) |
| `logger`    | `ILogger`    | Scoped logger                          |
| `meta`      | `Dict`       | Event metadata                         |
| `destroy()` | `() => void` | Mark entity as destroyed               |

**`ViewIdCtx<E>`** -- passed to `@ViewIdHandler` methods

| Property    | Type                  | Description               |
| ----------- | --------------------- | ------------------------- |
| `event`     | `E`                   | Event instance            |
| `aggregate` | `AggregateIdentifier` | Source aggregate identity |
| `logger`    | `ILogger`             | Scoped logger             |

**`ViewQueryCtx<Q, V>`** -- passed to `@ViewQueryHandler` methods

| Property     | Type                    | Description                                 |
| ------------ | ----------------------- | ------------------------------------------- |
| `query`      | `Q`                     | Query instance                              |
| `logger`     | `ILogger`               | Scoped logger                               |
| `repository` | `IProteusRepository<V>` | Full Proteus repository for the view entity |

**`ViewErrorCtx<V>`** -- passed to `@ViewErrorHandler` methods

| Property                   | Type      | Description                     |
| -------------------------- | --------- | ------------------------------- |
| `error`                    | `Error`   | The error                       |
| `entity`                   | `V`       | View entity instance            |
| `logger`                   | `ILogger` | Scoped logger                   |
| `dispatch(command, opts?)` | function  | Dispatch a compensating command |

---

## Type reference

### Identity and state

```ts
type AggregateIdentifier = {
  id: string;
  name: string;
  namespace: string;
};

type AggregateState<S> = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  events: Array<unknown>;
  numberOfLoadedEvents: number;
  state: S;
};

type SagaState<S> = {
  id: string;
  name: string;
  namespace: string;
  destroyed: boolean;
  messagesToDispatch: Array<unknown>;
  revision: number;
  state: S;
  createdAt: Date;
  updatedAt: Date;
};
```

### Dispatch options

```ts
type SagaDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};

type ErrorDispatchOptions = {
  id?: string;
  delay?: number;
  mandatory?: boolean;
  meta?: Dict;
};
```

### Replay

```ts
type ReplayOptions = {
  strategy?: "truncate";
};

type ReplayProgress = {
  phase: "truncating" | "replaying" | "resuming" | "complete";
  processed: number;
  total: number;
  percent: number;
  skipped: number;
};

type ReplayHandle = {
  on(event: "progress", cb: (p: ReplayProgress) => void): void;
  on(event: "complete", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  cancel(): void;
  promise: Promise<void>;
};
```

### Configuration

```ts
type HermesStatus = "created" | "initialising" | "ready" | "stopping" | "stopped";
type ChecksumMode = "strict" | "warn";
```

---

## Error reference

All domain errors extend `DomainError` which carries a `permanent` flag.
Permanent errors are never retried by the infrastructure.

| Error                          | Permanent    | When                                                    |
| ------------------------------ | ------------ | ------------------------------------------------------- |
| `DomainError`                  | configurable | Base class for domain-level errors                      |
| `AggregateAlreadyCreatedError` | yes          | Command targets an aggregate that already exists        |
| `AggregateNotCreatedError`     | yes          | Command targets an aggregate that doesn't exist         |
| `AggregateDestroyedError`      | yes          | Command targets a destroyed aggregate                   |
| `AggregateNotDestroyedError`   | yes          | Expected aggregate to be destroyed                      |
| `SagaAlreadyCreatedError`      | configurable | Event received for an already-created saga              |
| `SagaNotCreatedError`          | configurable | Event received for a non-existent saga                  |
| `SagaDestroyedError`           | yes          | Event received for a destroyed saga                     |
| `ViewAlreadyCreatedError`      | configurable | Event received for an already-created view              |
| `ViewNotCreatedError`          | configurable | Event received for a non-existent view                  |
| `ViewDestroyedError`           | yes          | Event received for a destroyed view                     |
| `ViewNotUpdatedError`          | yes          | View handler did not mutate the entity                  |
| `CommandSchemaValidationError` | yes          | `@Validate` schema rejected the command payload         |
| `ChecksumError`                | yes          | Event checksum mismatch detected                        |
| `ConcurrencyError`             | no           | Optimistic concurrency conflict (automatically retried) |
| `CausationMissingEventsError`  | no           | Expected causation events not found                     |
| `HandlerNotRegisteredError`    | no           | No handler registered for command/event                 |
| `UpcasterChainError`           | no           | Upcaster chain is broken or circular                    |

---

## License

Distributed under the AGPL-3.0-or-later license. See `LICENSE` for more information.
