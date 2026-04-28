# @lindorm/hermes

A decorator-driven CQRS and Event Sourcing framework for TypeScript, with pluggable persistence and messaging supplied by `@lindorm/proteus` and `@lindorm/iris`.

This package is **ESM-only**. All examples use `import`; `require` is not supported.

## Installation

```bash
npm install @lindorm/hermes
```

### Peer dependencies

Hermes does not bundle persistence or messaging. The following peers are required at runtime — install them alongside Hermes:

| Peer               | Range    | Purpose                                                |
| ------------------ | -------- | ------------------------------------------------------ |
| `@lindorm/iris`    | `^0.2.0` | Messaging source (command queue, event bus, timeouts). |
| `@lindorm/logger`  | `^0.5.3` | Structured logger interface (`ILogger`).               |
| `@lindorm/proteus` | `^0.5.0` | Persistence source (event store, sagas, views).        |

Concrete drivers for each peer (postgres, mongodb, redis, rabbit, kafka, memory, …) are configured on the `ProteusSource` and `IrisSource` instances you pass to Hermes.

## Concepts

| Concept   | Purpose                                                                                  |
| --------- | ---------------------------------------------------------------------------------------- |
| Aggregate | Owns business state and invariants. Accepts commands and applies events.                 |
| Saga      | Long-running process manager. Reacts to events, dispatches commands, schedules timeouts. |
| View      | Read-model projection updated by events. Backed by a Proteus entity.                     |
| Query     | Stateless read handler that runs against a view's repository.                            |
| Timeout   | Delayed message scheduled by a saga and processed later.                                 |

All four are plain classes annotated with Hermes decorators, discovered automatically by the scanner or registered explicitly.

## Quick start

```ts
import { Hermes } from "@lindorm/hermes";
import { IrisSource } from "@lindorm/iris";
import { ProteusSource } from "@lindorm/proteus";

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

const { id } = await hermes.command(new OpenAccount("Alice", "USD", 500));
await hermes.command(new DepositFunds(200, "USD"), { id });

const summary = await hermes.query<AccountSummaryView>(new GetAccountSummary(id));

await hermes.teardown();
```

## Module discovery

`modules` accepts class constructors, file paths, directory paths, or any mix of the three. Directories are scanned recursively; every imported module is inspected and any class carrying Hermes metadata is registered.

```ts
const hermes = new Hermes({
  proteus,
  iris,
  logger,
  modules: [
    `${import.meta.dirname}/modules`, // scan a directory
    SomeOtherAggregate, // add a class directly
  ],
});
```

Files whose name contains `test`, `spec`, `fixture`, or `integration` are skipped, and `index` files are ignored.

During `setup()`, Hermes reads decorator metadata from every registered class to wire commands, events, aggregates, sagas, views, queries, timeouts, and event upcasters. View entities declared via `@View(AggregateClass, EntityClass)` are registered with the appropriate `ProteusSource` automatically — no manual entity registration is required.

## Defining commands

Commands are DTO classes decorated with `@Command()`. The class name supplies the default name (snake-cased) and version (suffix `_V<n>`).

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

export const OpenAccountSchema = z.object({
  ownerName: z.string().min(1),
  currency: z.string().length(3),
  initialDeposit: z.number().nonnegative(),
});
```

`@Command()` accepts an optional name string or `{ name?, version? }` object. Commands without payload are valid:

```ts
@Command()
export class CloseAccount {}
```

## Defining events

Events are DTOs decorated with `@Event()`. Like commands, the class name supplies a default name and version.

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

When evolving an event schema, use suffixed class names (`FundsDeposited_V1`, `FundsDeposited_V2`) and register an `@EventUpcaster`.

## Defining an aggregate

```ts
import {
  Aggregate,
  AggregateCommandHandler,
  AggregateErrorHandler,
  AggregateEventHandler,
  DomainError,
  EventUpcaster,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  Validate,
} from "@lindorm/hermes";
import type {
  AggregateCommandCtx,
  AggregateErrorCtx,
  AggregateEventCtx,
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

  @AggregateCommandHandler(WithdrawFunds)
  @RequireCreated()
  @Validate(WithdrawFundsSchema)
  async onWithdrawFunds(
    ctx: AggregateCommandCtx<WithdrawFunds, AccountState>,
  ): Promise<void> {
    if (ctx.state.balance < ctx.command.amount) {
      throw new DomainError("Insufficient funds", {
        permanent: true,
        data: { balance: ctx.state.balance, requested: ctx.command.amount },
      });
    }
    await ctx.apply(new FundsWithdrawn(ctx.command.amount));
  }

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

  @AggregateEventHandler(FundsWithdrawn)
  async onFundsWithdrawn(
    ctx: AggregateEventCtx<FundsWithdrawn, AccountState>,
  ): Promise<void> {
    ctx.mergeState({
      balance: ctx.state.balance - ctx.event.amount,
      transactionCount: ctx.state.transactionCount + 1,
    });
  }

  @EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)
  upcastFundsDepositedV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
    return new FundsDeposited_V2(event.amount, "USD");
  }

  @AggregateErrorHandler(DomainError)
  async onDomainError(ctx: AggregateErrorCtx): Promise<void> {
    ctx.logger.warn("Aggregate domain error", { error: ctx.error.message });
  }
}
```

A new aggregate instance is constructed for every handler invocation. Do not depend on constructor injection or instance fields persisting between calls — all per-aggregate state lives in the `ctx.state` snapshot rebuilt from the event store on demand.

### Aggregate command handler context

| Property           | Type                                  | Description                       |
| ------------------ | ------------------------------------- | --------------------------------- |
| `ctx.command`      | `C`                                   | Command instance.                 |
| `ctx.state`        | `S`                                   | Current aggregate state.          |
| `ctx.logger`       | `ILogger`                             | Per-message scoped logger.        |
| `ctx.meta`         | `Dict`                                | Command metadata.                 |
| `ctx.apply(event)` | `(event: ClassLike) => Promise<void>` | Append an event to the aggregate. |

### Aggregate event handler context

| Property                  | Type                       | Description                      |
| ------------------------- | -------------------------- | -------------------------------- |
| `ctx.event`               | `E`                        | Event instance.                  |
| `ctx.state`               | `S`                        | Current aggregate state.         |
| `ctx.logger`              | `ILogger`                  | Per-message scoped logger.       |
| `ctx.meta`                | `Dict`                     | Event metadata.                  |
| `ctx.mergeState(partial)` | `(DeepPartial<S>) => void` | Shallow-merge into state.        |
| `ctx.setState(state)`     | `(S) => void`              | Replace state entirely.          |
| `ctx.destroy()`           | `() => void`               | Mark the aggregate as destroyed. |
| `ctx.destroyNext()`       | `() => void`               | Destroy after the next event.    |

### Aggregate error handler context

| Property                   | Type                                         | Description                      |
| -------------------------- | -------------------------------------------- | -------------------------------- |
| `ctx.error`                | `Error`                                      | The thrown error.                |
| `ctx.logger`               | `ILogger`                                    | Per-message scoped logger.       |
| `ctx.dispatch(cmd, opts?)` | `(ClassLike, ErrorDispatchOptions?) => void` | Dispatch a compensating command. |

## Defining a saga

```ts
import {
  Saga,
  SagaErrorHandler,
  SagaEventHandler,
  SagaIdHandler,
  SagaTimeoutHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  SagaErrorCtx,
  SagaEventCtx,
  SagaIdCtx,
  SagaTimeoutCtx,
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
      ctx.dispatch(new FlagAccount(`Balance dropped to ${newBalance}`), {
        id: ctx.aggregate.id,
      });
    }
  }

  @SagaIdHandler(AccountOpened)
  resolveId(ctx: SagaIdCtx<AccountOpened>): string {
    return ctx.aggregate.id;
  }

  @SagaTimeoutHandler(InactivityTimeout)
  async onInactivityTimeout(
    ctx: SagaTimeoutCtx<InactivityTimeout, OverdraftProtectionState>,
  ): Promise<void> {
    ctx.logger.info("Inactivity timeout fired", { accountId: ctx.event.accountId });
    ctx.timeout("inactivity_check", { accountId: ctx.event.accountId }, 30_000);
  }

  @SagaErrorHandler(DomainError)
  async onDomainError(ctx: SagaErrorCtx): Promise<void> {
    ctx.logger.warn("Saga domain error", { error: ctx.error.message });
  }
}
```

`@Saga()` accepts a single aggregate class or an array, plus an optional `{ name? }` override. Every event the saga handles also needs a `@SagaIdHandler` that resolves the saga ID from the source event.

### Saga event handler context

| Property                           | Type                                        | Description                                 |
| ---------------------------------- | ------------------------------------------- | ------------------------------------------- |
| `ctx.event`                        | `E`                                         | Event instance.                             |
| `ctx.state`                        | `S`                                         | Current saga state.                         |
| `ctx.aggregate`                    | `AggregateIdentifier`                       | Source aggregate `{ id, name, namespace }`. |
| `ctx.logger`                       | `ILogger`                                   | Per-message scoped logger.                  |
| `ctx.meta`                         | `Dict`                                      | Event metadata.                             |
| `ctx.mergeState(partial)`          | `(DeepPartial<S>) => void`                  | Shallow-merge into state.                   |
| `ctx.setState(state)`              | `(S) => void`                               | Replace state entirely.                     |
| `ctx.destroy()`                    | `() => void`                                | Mark the saga as destroyed.                 |
| `ctx.dispatch(cmd, opts?)`         | `(ClassLike, SagaDispatchOptions?) => void` | Dispatch a command.                         |
| `ctx.timeout(name, data, delayMs)` | `(string, Dict, number) => void`            | Schedule a timeout DTO.                     |

`SagaTimeoutCtx<E, S>` has the same shape as `SagaEventCtx<E, S>`. `SagaIdCtx<E>` exposes `event`, `aggregate`, and `logger`. `SagaErrorCtx` mirrors `AggregateErrorCtx`.

## Defining a view

A view is a read-model projection that materialises events into a Proteus entity. It is split into two classes: the entity (state shape) and the projection (event handlers and query handlers).

### Step 1: define the view entity

```ts
import { Default, Entity, Field, Index, Namespace } from "@lindorm/proteus";
import { HermesViewEntity } from "@lindorm/hermes";

@Entity({ name: "account_summary" })
@Namespace("banking")
export class AccountSummaryView extends HermesViewEntity {
  @Field("string") @Index() @Default("") ownerName: string = "";
  @Field("string") @Default("USD") currency: string = "USD";
  @Field("float") @Default(0) balance: number = 0;
  @Field("string") @Index() @Default("open") status: string = "open";
  @Field("integer") @Default(0) transactionCount: number = 0;
}
```

`HermesViewEntity` is an `@AbstractEntity` providing `id`, `destroyed`, `revision`, `createdAt`, and `updatedAt`. Concrete views must extend it.

### Step 2: define the projection

```ts
import {
  View,
  ViewErrorHandler,
  ViewEventHandler,
  ViewIdHandler,
  ViewQueryHandler,
  Namespace,
  RequireCreated,
  RequireNotCreated,
  DomainError,
} from "@lindorm/hermes";
import type {
  ViewErrorCtx,
  ViewEventCtx,
  ViewIdCtx,
  ViewQueryCtx,
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

  @ViewEventHandler(FundsWithdrawn)
  @RequireCreated()
  async onFundsWithdrawn(
    ctx: ViewEventCtx<FundsWithdrawn, AccountSummaryView>,
  ): Promise<void> {
    ctx.entity.balance -= ctx.event.amount;
    ctx.entity.transactionCount += 1;
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

View handlers mutate `ctx.entity` directly; the entity is persisted by the framework after the handler resolves. `@View(...)` accepts a single aggregate class or an array, plus an optional `driverType` string to route the view to one of the `viewSources` configured on `Hermes`.

### View handler contexts

| Context              | Properties                                              |
| -------------------- | ------------------------------------------------------- |
| `ViewEventCtx<E, V>` | `event`, `entity`, `logger`, `meta`, `destroy()`.       |
| `ViewIdCtx<E>`       | `event`, `aggregate`, `logger`.                         |
| `ViewQueryCtx<Q, V>` | `query`, `logger`, `repository: IProteusRepository<V>`. |
| `ViewErrorCtx<V>`    | `error`, `entity`, `logger`, `dispatch(cmd, opts?)`.    |

## Defining queries

```ts
import { Query } from "@lindorm/hermes";

@Query()
export class GetAccountSummary {
  public constructor(public readonly accountId: string) {}
}
```

Queries are dispatched via `hermes.query(...)` and matched to a `@ViewQueryHandler` method on a view.

## Defining timeouts

```ts
import { Timeout } from "@lindorm/hermes";

@Timeout()
export class InactivityTimeout {
  public constructor(public readonly accountId: string) {}
}
```

Sagas schedule timeouts with `ctx.timeout(name, data, delayMs)`; the delay is taken in milliseconds. The matching `@SagaTimeoutHandler(TimeoutClass)` runs once the delay elapses.

## Event upcasting

When an event schema changes, register an `@EventUpcaster(FromClass, ToClass)` method on the owning aggregate. The original record in the event store is never modified — old events are converted to the new shape at load time only.

```ts
@Event()
export class FundsDeposited_V1 {
  public constructor(public readonly amount: number) {}
}

@Event()
export class FundsDeposited_V2 {
  public constructor(
    public readonly amount: number,
    public readonly currency: string,
  ) {}
}

@EventUpcaster(FundsDeposited_V1, FundsDeposited_V2)
upcastV1toV2(event: FundsDeposited_V1): FundsDeposited_V2 {
  return new FundsDeposited_V2(event.amount, "USD");
}
```

Upcaster chains (V1 → V2 → V3 → …) are resolved transitively. A broken or circular chain throws `UpcasterChainError` during `setup()`.

## Validation with Zod

`@Validate(schema)` runs a Zod schema against the command payload before the handler executes. A failure throws `CommandSchemaValidationError` (permanent — the command is not retried).

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

## Lifecycle guards

`@RequireCreated()` and `@RequireNotCreated()` enforce existence preconditions on aggregate command handlers, saga event handlers, and view event handlers.

```ts
@AggregateCommandHandler(OpenAccount)
@RequireNotCreated()
async onOpenAccount(ctx: AggregateCommandCtx<OpenAccount, AccountState>): Promise<void> { /* ... */ }

@AggregateCommandHandler(DepositFunds)
@RequireCreated()
async onDepositFunds(ctx: AggregateCommandCtx<DepositFunds, AccountState>): Promise<void> { /* ... */ }
```

A guard violation throws the corresponding `Aggregate*`/`Saga*`/`View*` error (see [error reference](#error-reference)).

## Forgettable aggregates

Annotate an aggregate with `@Forgettable()` to opt into per-aggregate event-payload encryption. When an aggregate is destroyed and the encryption key is purged, the persisted event payloads become unrecoverable, satisfying GDPR-style erasure requirements.

```ts
import { Forgettable } from "@lindorm/hermes";

@Aggregate()
@Forgettable()
@Namespace("banking")
export class CustomerAggregate {
  /* ... */
}
```

Configure `HermesOptions.encryption` to control the JWE algorithm and content-encryption used for the per-aggregate encryption keys; both fields fall back to safe defaults (`"dir"` and `"A256GCM"`) when omitted.

## Error handling

Domain errors are routed to `@AggregateErrorHandler`, `@SagaErrorHandler`, and `@ViewErrorHandler` methods filtered by error class. `DomainError` carries a `permanent` flag — permanent errors are not retried by Iris; transient ones flow through the configured retry policy of the underlying `IIrisSource`.

```ts
@SagaErrorHandler(DomainError)
async onSagaError(ctx: SagaErrorCtx): Promise<void> {
  ctx.dispatch(new CompensateCommand(), { id: ctx.aggregate.id });
}
```

## Setting up Hermes

```ts
const hermes = new Hermes({
  proteus: new ProteusSource({ driver: "memory", logger }),
  iris: new IrisSource({ driver: "memory", logger }),
  modules: [AccountAggregate, OverdraftProtectionSaga, AccountSummaryProjection],
  logger,
  namespace: "banking",
  viewSources: [
    /* additional ProteusSource for @View(..., ..., "<driverType>") */
  ],
  encryption: { algorithm: "dir", encryption: "A256GCM" },
  checksumMode: "strict",
  causationExpiry: "7 days",
});

await hermes.setup();
// ... use hermes ...
await hermes.teardown();
```

### `HermesOptions`

| Option            | Type                                                                  | Required | Description                                                                        |
| ----------------- | --------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| `proteus`         | `IProteusSource`                                                      | yes      | Primary persistence source (event store, sagas, default view source).              |
| `iris`            | `IIrisSource`                                                         | yes      | Messaging source (command queue, event bus, error queue, timeout queue).           |
| `modules`         | `Array<Constructor \| string>`                                        | yes      | Class constructors and/or directory paths to scan.                                 |
| `logger`          | `ILogger`                                                             | yes      | Logger instance; per-message child loggers are created automatically.              |
| `viewSources`     | `Array<IProteusSource>`                                               | no       | Additional Proteus sources for views routed via `@View(..., ..., "<driverType>")`. |
| `namespace`       | `string`                                                              | no       | Default namespace for handlers without `@Namespace(...)`. Defaults to `"hermes"`.  |
| `encryption`      | `{ algorithm?: KryptosEncAlgorithm; encryption?: KryptosEncryption }` | no       | Encryption settings used by `@Forgettable()` aggregates.                           |
| `checksumMode`    | `"strict" \| "warn"`                                                  | no       | How to react to a checksum mismatch. Defaults to `"warn"`.                         |
| `causationExpiry` | `ReadableTime`                                                        | no       | Causation record TTL (for example `"30 days"`). Defaults to `"30 Days"`.           |

### Lifecycle

| Member                        | Description                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `hermes.setup()`              | Scans modules, builds the registry, registers entities and messages, starts consumers.       |
| `hermes.teardown()`           | Unconsumes all queues, unsubscribes the event bus, and detaches domain emitters.             |
| `hermes.session({ logger? })` | Returns a request-scoped `HermesSession` that shares state but carries its own child logger. |
| `hermes.status`               | Returns `"created" \| "initialising" \| "ready" \| "stopping" \| "stopped"`.                 |

`Hermes` and `HermesSession` both implement `IHermesProvider` (`status`, `command`, `query`). The session has no lifecycle or admin methods — use it for per-request command/query traffic with a request-scoped logger.

## Dispatching commands

```ts
const { id, name, namespace } = await hermes.command(
  new OpenAccount("Alice", "USD", 500),
);

await hermes.command(new DepositFunds(200, "USD"), { id });

await hermes.command(new DepositFunds(100, "USD"), {
  id,
  correlationId: "tx-123",
  delay: 5_000,
  meta: { source: "api" },
});
```

`command()` returns the `AggregateIdentifier` (`{ id, name, namespace }`) the command targets; `id` is generated when not supplied.

## Querying views

```ts
const summary = await hermes.query<AccountSummaryView | null>(
  new GetAccountSummary(accountId),
);
```

The return type is whatever the matching `@ViewQueryHandler` resolves to. Supply it as the generic argument.

## Sessions

`hermes.session({ logger? })` returns a lightweight `HermesSession` that shares the parent's domains, queues, and registry. Use it to attach a per-request logger without creating a new `Hermes` instance.

```ts
const requestLogger = baseLogger.child(["request", requestId]);
const session = hermes.session({ logger: requestLogger });

await session.command(new DepositFunds(50, "USD"), { id });
```

## Event emitter

`hermes.on(event, callback)` and `hermes.off(event, callback)` subscribe to internal change notifications. The event prefix must be `"saga"`, `"view"`, or `"checksum"`; further dot-separated segments narrow the subscription:

```ts
hermes.on("saga", (data) => {
  /* any saga */
});
hermes.on("saga.banking", (data) => {
  /* any saga in the banking namespace */
});
hermes.on("saga.banking.overdraft_protection", (data) => {
  /* a specific saga type */
});
hermes.on(`saga.banking.overdraft_protection.${id}`, (data) => {
  /* one instance */
});
```

An unrecognised prefix throws.

## Admin API

`hermes.admin` exposes inspection, replay, and maintenance helpers.

### Inspect

```ts
const aggregate = await hermes.admin.inspect.aggregate<AccountState>({
  id,
  name: "account_aggregate",
  namespace: "banking",
});
// => { id, name, namespace, destroyed, events, numberOfLoadedEvents, state }

const saga = await hermes.admin.inspect.saga<OverdraftProtectionState>({
  id,
  name: "overdraft_protection",
  namespace: "banking",
});
// => SagaState | null

const view = await hermes.admin.inspect.view<AccountSummaryView>({
  id,
  entity: AccountSummaryView,
});
// => AccountSummaryView | null
```

If `namespace` is omitted, the Hermes instance default is used.

### Replay

```ts
const handle = hermes.admin.replay.view(AccountSummaryView);

handle.on("progress", (p) => console.log(`${p.phase}: ${p.percent}%`));
handle.on("complete", () => console.log("done"));
handle.on("error", (err) => console.error(err));

await handle.promise;
// or: await handle.cancel();
```

`replay.view(entity)` truncates the view table, deletes the corresponding causation records, and re-processes every persisted event for the bound aggregates in temporal order. `replay.aggregate(aggregateClass)` chains `replay.view` for every view bound to that aggregate. Cancelling mid-replay leaves the view partially populated — re-run to recover.

### Maintenance

```ts
const removed = await hermes.admin.purgeCausations();
```

Deletes expired causation records from the primary `proteus` source and every configured `viewSources` entry, returning the total count purged.

## CLI

The package ships a `hermes` binary backed by `commander`:

```bash
npx hermes init                 # scaffold ./src/hermes
npx hermes generate command     # generate a @Command DTO
npx hermes generate event       # generate an @Event DTO
npx hermes generate query       # generate a @Query DTO
npx hermes generate timeout     # generate a @Timeout DTO
npx hermes generate aggregate   # generate an @Aggregate skeleton
npx hermes generate saga        # generate a @Saga skeleton
npx hermes generate view        # generate a @View skeleton
```

Every subcommand supports `-d, --directory <path>` for the output location and `--dry-run` to preview without writing.

## Testing

Pre-built mocks of `IHermes` and `IHermesSession` are exported for the two major test runners:

```ts
import { createMockHermes, createMockHermesSession } from "@lindorm/hermes/mocks/vitest";
// or
import { createMockHermes, createMockHermesSession } from "@lindorm/hermes/mocks/jest";

const hermes = createMockHermes();
hermes.command.mockResolvedValue({ id: "test-id", name: "x", namespace: "y" });
```

Both subpaths return the same structural mocks, wired with `vi.fn()` or `jest.fn()` respectively.

## Decorator reference

### DTO decorators (class-level)

| Decorator                                | Description                                    |
| ---------------------------------------- | ---------------------------------------------- |
| `@Command(name? \| { name?, version? })` | Marks a class as a command DTO.                |
| `@Event(name? \| { name?, version? })`   | Marks a class as an event DTO.                 |
| `@Query(name?)`                          | Marks a class as a query DTO (version is `1`). |
| `@Timeout(name? \| { name?, version? })` | Marks a class as a timeout DTO.                |

### Domain decorators (class-level)

| Decorator                                                             | Description                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `@Aggregate(name?)`                                                   | Marks a class as an aggregate handler.                              |
| `@Saga(AggregateClass \| AggregateClass[], { name? }?)`               | Marks a class as a saga bound to one or more aggregates.            |
| `@View(AggregateClass \| AggregateClass[], EntityClass, driverType?)` | Marks a class as a view bound to aggregate(s) and a Proteus entity. |

### Composable class-level decorators

| Decorator            | Description                                                     |
| -------------------- | --------------------------------------------------------------- |
| `@Namespace(string)` | Scopes the class to a namespace.                                |
| `@Forgettable()`     | Enables encrypted-and-forgettable event storage for aggregates. |

### Handler decorators (method-level)

| Decorator                                | Description                                        |
| ---------------------------------------- | -------------------------------------------------- |
| `@AggregateCommandHandler(CommandClass)` | Handles a command on an aggregate.                 |
| `@AggregateEventHandler(EventClass)`     | Handles an event on an aggregate (state mutation). |
| `@AggregateErrorHandler(ErrorClass)`     | Handles errors raised inside the aggregate.        |
| `@EventUpcaster(FromClass, ToClass)`     | Transforms an old event version to a newer one.    |
| `@SagaEventHandler(EventClass)`          | Handles an event on a saga.                        |
| `@SagaIdHandler(EventClass)`             | Resolves the saga ID for an event.                 |
| `@SagaTimeoutHandler(TimeoutClass)`      | Handles a scheduled timeout on a saga.             |
| `@SagaErrorHandler(ErrorClass)`          | Handles errors raised inside the saga.             |
| `@ViewEventHandler(EventClass)`          | Handles an event on a view (mutates `ctx.entity`). |
| `@ViewIdHandler(EventClass)`             | Resolves the view entity ID for an event.          |
| `@ViewQueryHandler(QueryClass)`          | Handles a query against the view's repository.     |
| `@ViewErrorHandler(ErrorClass)`          | Handles errors raised inside the view.             |

### Composable method-level decorators

| Decorator              | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `@RequireCreated()`    | Skips the handler unless the aggregate/saga/view exists.    |
| `@RequireNotCreated()` | Skips the handler unless the aggregate/saga/view is absent. |
| `@Validate(zodSchema)` | Validates a command payload before the handler runs.        |

## Type reference

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
  events: Array<{
    id: string;
    name: string;
    version: number;
    data: Dict;
    meta: Dict;
    causationId: string;
    correlationId: string | null;
    timestamp: Date;
  }>;
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

interface ReplayHandle {
  on(event: "progress", cb: (p: ReplayProgress) => void): void;
  on(event: "complete", cb: () => void): void;
  on(event: "error", cb: (err: Error) => void): void;
  cancel(): Promise<void>;
  promise: Promise<void>;
}

type ChecksumMode = "strict" | "warn";
type HermesStatus = "created" | "initialising" | "ready" | "stopping" | "stopped";
type HermesEventName =
  | "saga"
  | "view"
  | "checksum"
  | `saga.${string}`
  | `view.${string}`
  | `checksum.${string}`;
```

## Error reference

`DomainError` (and `DomainErrorOptions` for its `permanent` flag) are exported from `@lindorm/hermes`. The framework also exports concrete subclasses for the conditions it raises internally:

| Error                          | Permanent    | Raised when                                                        |
| ------------------------------ | ------------ | ------------------------------------------------------------------ |
| `DomainError`                  | configurable | Base class — set `{ permanent: true }` to suppress retries.        |
| `AggregateAlreadyCreatedError` | yes          | Command targets an aggregate that already exists.                  |
| `AggregateNotCreatedError`     | yes          | Command targets an aggregate that does not exist yet.              |
| `AggregateDestroyedError`      | yes          | Command targets a destroyed aggregate.                             |
| `AggregateNotDestroyedError`   | yes          | Expected the aggregate to be destroyed but it was not.             |
| `SagaAlreadyCreatedError`      | configurable | Event would create a saga that already exists.                     |
| `SagaNotCreatedError`          | configurable | Event would update a saga that does not exist yet.                 |
| `SagaDestroyedError`           | yes          | Event targets a destroyed saga.                                    |
| `ViewAlreadyCreatedError`      | configurable | Event would create a view entity that already exists.              |
| `ViewNotCreatedError`          | configurable | Event would update a view entity that does not exist yet.          |
| `ViewDestroyedError`           | yes          | Event targets a destroyed view entity.                             |
| `ViewNotUpdatedError`          | yes          | View handler returned without mutating `ctx.entity`.               |
| `CommandSchemaValidationError` | yes          | `@Validate` schema rejected the command payload.                   |
| `ChecksumError`                | yes          | Persisted event checksum did not match the recomputed checksum.    |
| `ConcurrencyError`             | n/a          | Optimistic-concurrency conflict (extends `LindormError`).          |
| `CausationMissingEventsError`  | n/a          | Causation produced no events on an aggregate (`LindormError`).     |
| `HandlerNotRegisteredError`    | n/a          | No handler registered for the dispatched command (`LindormError`). |
| `UpcasterChainError`           | n/a          | Event upcaster chain is broken or circular (`LindormError`).       |

`ConcurrencyError`, `CausationMissingEventsError`, `HandlerNotRegisteredError`, and `UpcasterChainError` extend `LindormError` directly and therefore have no `permanent` flag.

## License

Distributed under the AGPL-3.0-or-later license.
