# @lindorm/iris

Decorator-driven messaging for Node.js with a single API across multiple brokers. Define messages once, publish and subscribe against memory, RabbitMQ, Kafka, NATS, or Redis Streams.

## Install

```bash
npm install @lindorm/iris
```

This package is **ESM-only** and ships native (TC39 stage 3) decorators. Use it from an ESM project (`"type": "module"`) and a TypeScript version that supports stage 3 decorators (TS 5+). The package polyfills `Symbol.metadata` for older Node versions, so no extra setup is required.

## Supported Drivers

Iris is broker-agnostic. The driver is chosen via the `IrisSource` constructor; the matching peer dependency is loaded lazily and only needs to be installed for the driver(s) you use.

| Driver   | Peer Dependency |
| -------- | --------------- |
| `memory` | _(none)_        |
| `rabbit` | `amqplib` ^0.10 |
| `kafka`  | `kafkajs` ^2.2  |
| `nats`   | `nats` ^2.29    |
| `redis`  | `ioredis` ^5.10 |

`@lindorm/amphora` ^0.4 is an optional peer used for payload encryption (`@Encrypted`). `@lindorm/logger` ^0.5 is a required peer — every `IrisSource` takes an `ILogger`.

```bash
npm install amqplib       # RabbitMQ
npm install kafkajs       # Kafka
npm install nats          # NATS
npm install ioredis       # Redis Streams
npm install @lindorm/amphora  # Encryption (optional)
```

## Quick Start

### 1. Define a Message

```typescript
import {
  Field,
  IdentifierField,
  Message,
  Namespace,
  TimestampField,
  Version,
} from "@lindorm/iris";

@Message()
@Namespace("orders")
@Version(1)
class OrderPlaced {
  @IdentifierField() id!: string;
  @TimestampField() createdAt!: Date;
  @Field("string") orderId!: string;
  @Field("float") total!: number;
}
```

### 2. Create a Source

```typescript
import { IrisSource } from "@lindorm/iris";

const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger: myLogger,
  messages: [OrderPlaced],
});

await source.connect();
await source.setup();
```

### 3. Publish and Subscribe

```typescript
const bus = source.messageBus(OrderPlaced);

await bus.subscribe({
  topic: "OrderPlaced",
  queue: "order-service",
  callback: async (msg, envelope) => {
    console.log(`Order ${msg.orderId} placed for $${msg.total}`);
  },
});

const msg = bus.create({ orderId: "abc-123", total: 59.99 });
await bus.publish(msg);
```

### 4. Graceful Shutdown

```typescript
await source.drain();
await source.disconnect();
```

## Messaging Patterns

Every primitive below is created from an `IrisSource` (or a session — see [Sessions](#sessions)) and is bound to a single message class.

### Publisher

Write-only. Use when a service produces messages but never consumes them.

```typescript
const pub = source.publisher(OrderPlaced);

const msg = pub.create({ orderId: "abc-123", total: 59.99 });
await pub.publish(msg);

await pub.publish([msg1, msg2, msg3]);
```

### Message Bus

Pub/sub with topic-based subscriptions. Supports broadcast and competing-consumer queues.

```typescript
const bus = source.messageBus(OrderPlaced);

await bus.subscribe({
  topic: "OrderPlaced",
  callback: async (msg) => {
    /* every subscriber gets every message */
  },
});

await bus.subscribe({
  topic: "OrderPlaced",
  queue: "order-processors",
  callback: async (msg) => {
    /* round-robin across consumers in this queue */
  },
});

await bus.subscribe([
  { topic: "OrderPlaced", queue: "analytics", callback: handleAnalytics },
  { topic: "OrderPlaced", queue: "notifications", callback: handleNotify },
]);

await bus.unsubscribe({ topic: "OrderPlaced", queue: "analytics" });
await bus.unsubscribeAll();
```

### Worker Queue

Specialised competing-consumer queue where every message is processed by exactly one consumer.

```typescript
const queue = source.workerQueue(OrderPlaced);

await queue.consume("process-orders", async (msg, envelope) => {
  console.log(`Processing order ${msg.orderId} (attempt ${envelope.attempt})`);
});

await queue.publish(queue.create({ orderId: "abc-123", total: 59.99 }));

await queue.unconsume("process-orders");
await queue.unconsumeAll();
```

### RPC

Request/response over the broker.

```typescript
@Message()
class GetPrice {
  @Field("string") sku!: string;
}

@Message()
class PriceResponse {
  @Field("float") price!: number;
  @Field("string") currency!: string;
}

const client = source.rpcClient(GetPrice, PriceResponse);
const server = source.rpcServer(GetPrice, PriceResponse);

await server.serve(async (req) => {
  const res = new PriceResponse();
  res.price = await lookupPrice(req.sku);
  res.currency = "USD";
  return res;
});

const req = new GetPrice();
req.sku = "WIDGET-42";

const res = await client.request(req);
const resWithTimeout = await client.request(req, { timeout: 5000 });

await client.close();
await server.unserveAll();
```

### Stream Processor

Declarative pipelines built with an immutable builder. The pipeline is started, paused, resumed, and stopped explicitly.

```typescript
const pipeline = source
  .stream()
  .from(RawEvent)
  .filter((msg) => msg.value > 0)
  .map((msg) => {
    const out = new AggregatedEvent();
    out.sum = msg.value;
    out.count = 1;
    return out;
  })
  .to(AggregatedEvent);

await pipeline.start();
pipeline.isRunning(); // true
await pipeline.pause();
await pipeline.resume();
await pipeline.stop();
```

The builder also exposes `flatMap((msg) => Array<T>)` and `batch(size, { timeout? })` between `from(...)` and `to(...)`.

## Field Types

`@Field()` accepts the following type identifiers:

| Category       | Types                            |
| -------------- | -------------------------------- |
| Boolean        | `boolean`                        |
| Integer        | `integer`, `bigint`              |
| Floating point | `float`                          |
| String         | `string`, `email`, `url`, `uuid` |
| Enum           | `enum`                           |
| Date/Time      | `date`                           |
| Structured     | `object`, `array`                |

```typescript
@Message()
class Example {
  @IdentifierField() id!: string;
  @CorrelationField() correlationId!: string;
  @TimestampField() createdAt!: Date;

  @Field("string") name!: string;
  @Field("integer") count!: number;
  @Field("float") price!: number;
  @Field("boolean") active!: boolean;
  @Field("date") expiresAt!: Date;
  @Field("uuid") referenceId!: string;
  @Field("email") contactEmail!: string;
  @Field("url") callbackUrl!: string;
  @Field("array") tags!: Array<string>;
  @Field("object") metadata!: Record<string, unknown>;

  @Nullable() @Field("string") description!: string | null;
  @Optional() @Field("string") nickname?: string;
  @Default(0) @Field("integer") retryCount!: number;
  @Default(() => "generated") @Field("string") code!: string;
}
```

## Decorators

All decorators use the TC39 stage 3 specification. Class decorators receive `ClassDecoratorContext`, field decorators receive `ClassFieldDecoratorContext`. Metadata flows through the `Symbol.metadata` prototype chain, so abstract base classes propagate fields and hooks to concrete subclasses automatically.

### Class-Level Decorators

#### `@Message`

Marks a class as a concrete message and registers it in the global message registry. Every message must have exactly one of `@Message` or `@AbstractMessage`.

```typescript
@Message()
class OrderPlaced {
  /* ... */
}

@Message({ name: "order-placed" })
class OrderPlaced_v1 {
  /* ... */
}
```

**Options:** `{ name?: string }` — overrides the registered name. Defaults to the class name with any trailing `_v1`/`_V2` suffix stripped. Names must be unique across the registry.

#### `@AbstractMessage`

Marks a class as an abstract base. The class is **not** registered. Fields, hooks, and metadata are inherited by `@Message` subclasses through the metadata prototype chain.

```typescript
@AbstractMessage()
class BaseEvent {
  @IdentifierField() id!: string;
  @TimestampField() createdAt!: Date;
}

@Message()
@Namespace("orders")
class OrderPlaced extends BaseEvent {
  @Field("string") orderId!: string;
}
```

#### `@Namespace`

Places the message in a named namespace for routing and grouping.

```typescript
@Namespace("orders")
@Message()
class OrderPlaced {
  /* ... */
}
```

**Argument:** `string` — non-empty, non-whitespace. Throws `IrisMetadataError` otherwise.

#### `@Version`

Sets the message schema version.

```typescript
@Version(1)
@Message()
class OrderPlaced {
  /* ... */
}
```

**Argument:** `number` — positive integer (>= 1). Throws `IrisMetadataError` otherwise.

#### `@Topic`

Provides a callback that resolves the routing topic dynamically from the message instance instead of using the class name.

```typescript
@Topic((msg: RegionalEvent) => `events.${msg.region}.${msg.type}`)
@Message()
class RegionalEvent {
  @Field("string") region!: string;
  @Field("string") type!: string;
}
```

**Argument:** `(message: any) => string`.

#### `@Broadcast`

Marks a message for broadcast delivery. Every subscriber receives every message rather than competing for it.

```typescript
@Broadcast()
@Message()
class SystemNotification {
  /* ... */
}
```

#### `@Persistent`

Marks a message as durable. Persistent messages survive broker restarts where the underlying driver supports it.

```typescript
@Persistent()
@Message()
class PaymentCharge {
  /* ... */
}
```

#### `@Priority`

Default priority for a message type. Higher priority messages are delivered first where supported.

```typescript
@Priority(8)
@Message()
class UrgentAlert {
  /* ... */
}
```

**Argument:** `number` — integer in `[0, 10]`. Throws `IrisMetadataError` otherwise.

#### `@Delay`

Default delivery delay in milliseconds. Messages are held until the delay elapses. Can be overridden per publish via `PublishOptions.delay`.

```typescript
@Delay(5000)
@Message()
class ScheduledReminder {
  /* ... */
}
```

**Argument:** `number` — non-negative integer.

#### `@Expiry`

Default TTL in milliseconds. Unconsumed messages are discarded after this window. Can be overridden per publish via `PublishOptions.expiry`.

```typescript
@Expiry(60000)
@Message()
class TemporaryOffer {
  /* ... */
}
```

**Argument:** `number` — non-negative integer.

#### `@Encrypted`

Encrypts the payload via `@lindorm/amphora` before publishing and decrypts on consume. Requires `amphora` on `IrisSource`.

```typescript
@Encrypted()
@Message()
class SensitivePayload {
  @Field("string") ssn!: string;
}

@Encrypted({ purpose: "pii" })
@Message()
class MedicalRecord {
  @Field("object") data!: Record<string, unknown>;
}
```

**Argument:** `AmphoraPredicate` (defaults to `{}`) — predicate object that selects which key from the amphora key store is used (e.g. `algorithm`, `encryption`, `purpose`, `type`, `ownerId`, plus the standard `$eq`, `$in`, `$neq` operators).

#### `@Compressed`

Compresses the payload before publishing.

```typescript
@Compressed() // gzip (default)
@Compressed("brotli") // brotli
@Message()
class LargePayload {
  @Field("object") data!: Record<string, unknown>;
}
```

**Argument:** `"gzip" | "deflate" | "brotli"` (defaults to `"gzip"`). When combined with `@Encrypted`, compression runs first.

#### `@Retry`

Configures retry behavior when a consume callback throws.

```typescript
@Retry()
@Message()
class ProcessOrder {
  /* ... */
}

@Retry({
  maxRetries: 5,
  strategy: "exponential",
  delay: 1000,
  delayMax: 30000,
  multiplier: 2,
  jitter: true,
})
@Message()
class PaymentCharge {
  /* ... */
}
```

**Options:**

| Field        | Type                                          | Default      | Description                            |
| ------------ | --------------------------------------------- | ------------ | -------------------------------------- |
| `maxRetries` | `number`                                      | `3`          | Maximum number of retry attempts       |
| `strategy`   | `"constant"` \| `"linear"` \| `"exponential"` | `"constant"` | Backoff strategy                       |
| `delay`      | `number`                                      | `1000`       | Initial delay in milliseconds          |
| `delayMax`   | `number`                                      | `30000`      | Maximum delay cap in milliseconds      |
| `multiplier` | `number`                                      | `2`          | Multiplier used by exponential backoff |
| `jitter`     | `boolean`                                     | `false`      | Add randomness to spread retry storms  |

| Strategy        | Delay sequence (`delay=1000`, `multiplier=2`)        |
| --------------- | ---------------------------------------------------- |
| `"constant"`    | `1000, 1000, 1000, ...`                              |
| `"linear"`      | `1000, 2000, 3000, ...`                              |
| `"exponential"` | `1000, 2000, 4000, 8000, ...` (capped at `delayMax`) |

#### `@DeadLetter`

Routes messages that exhaust all retries to the configured dead letter store. Requires `@Retry` and `IrisSource.persistence.deadLetter`.

```typescript
@Retry({ maxRetries: 3 })
@DeadLetter()
@Message()
class PaymentCharge {
  /* ... */
}
```

### Field Decorators

Each field decorator declares one message field with its type, default, and nullability. Combine with the modifier decorators below.

#### `@Field`

Declares a field with an explicit type from the [Field Types](#field-types) table.

```typescript
@Field("string") name!: string;
@Field("integer") count!: number;
@Field("date") expiresAt!: Date;
@Field("array") tags!: Array<string>;
@Field("object") metadata!: Record<string, unknown>;
```

**Argument:** `MetaFieldType` (re-exported as `IrisFieldType`).

#### `@IdentifierField`

Auto-generated UUID v4 primary identifier. Equivalent to `@Default(() => randomUUID()) @Field("uuid")`. Non-nullable, non-optional.

```typescript
@IdentifierField() id!: string;
```

#### `@CorrelationField`

Auto-generated UUID v4 used to trace related messages across publish/consume chains. Equivalent to `@Default(() => randomUUID()) @Field("uuid")`. Non-nullable, non-optional.

```typescript
@CorrelationField() correlationId!: string;
```

#### `@TimestampField`

Auto-generated `Date` set on creation. Equivalent to `@Default(() => new Date()) @Field("date")`. Non-nullable, non-optional.

```typescript
@TimestampField() createdAt!: Date;
```

#### `@MandatoryField`

Boolean flag that defaults to `false`. Equivalent to `@Default(false) @Field("boolean")`.

```typescript
@MandatoryField() requiresApproval!: boolean;
```

#### `@PersistentField`

Boolean persistence flag that defaults to `false`. Equivalent to `@Default(false) @Field("boolean")`.

```typescript
@PersistentField() shouldPersist!: boolean;
```

### Field Modifiers

Stack these on top of a field decorator to refine its behavior.

#### `@Nullable` / `@Optional`

```typescript
@Nullable() @Field("string") description!: string | null;
@Optional() @Field("string") nickname?: string;
```

#### `@Default`

```typescript
@Default(0) @Field("integer") retryCount!: number;
@Default(() => "generated") @Field("string") code!: string;
```

**Argument:** `MetaFieldDefault` (re-exported as `IrisFieldDefault`) — a primitive value, an array/record of primitives, or a no-arg function returning one.

#### `@Generated`

Marks a field for automatic value generation when an instance is created.

```typescript
@Generated("uuid") @Field("uuid") traceId!: string;
@Generated("date") @Field("date") processedAt!: Date;
@Generated("string") @Field("string") token!: string;
@Generated("string", { length: 12 }) @Field("string") shortCode!: string;
@Generated("integer", { min: 1, max: 1000 }) @Field("integer") sequence!: number;
@Generated("float", { min: 0, max: 1 }) @Field("float") weight!: number;
```

**Strategies:** `"uuid" | "date" | "string" | "integer" | "float"` (re-exported as `IrisGeneratedStrategy`). **Options:** `{ length?, min?, max? }`.

#### `@Header`

Promotes a field to a transport header so it is accessible without deserialising the body.

```typescript
@Header() @Field("string") source!: string;
@Header("x-trace-id") @Field("uuid") traceId!: string;
```

**Argument:** `string?` — header name, defaults to the property name. Throws `IrisMetadataError` if it resolves to an empty string.

#### `@Enum`

Restricts the field to the values of a TypeScript enum or `Record<string, string | number>`. Enforced during validation.

```typescript
enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Delivered = "delivered",
}

@Enum(OrderStatus) @Field("enum") status!: OrderStatus;
```

#### `@Min` / `@Max`

Numeric bounds for number fields, length bounds for string fields.

```typescript
@Min(0) @Max(100) @Field("integer") score!: number;
@Min(1) @Max(255) @Field("string") name!: string;
```

#### `@Schema`

Attaches a Zod schema for fine-grained validation.

```typescript
import { z } from "zod";

@Schema(z.string().email()) @Field("email") email!: string;
@Schema(z.number().int().min(13).max(150)) @Field("integer") age!: number;
```

**Argument:** `z.ZodType`.

#### `@Transform`

Bidirectional transform between the in-memory field value and its serialised form. `to` runs on serialise, `from` runs on hydrate.

```typescript
@Transform({
  to: (value: string[]) => value.join(","),
  from: (raw: string) => raw.split(","),
})
@Field("string")
tags!: string[];
```

**Options:** `{ to: (value) => unknown, from: (raw) => unknown }` (the type is re-exported as `IrisTransformFn`).

### Lifecycle Hook Decorators

Hooks are class decorators. Each hook receives `(message, meta)` where `meta: IrisHookMeta` carries `{ correlationId, actor, timestamp }`. Hooks may be sync or async.

| Decorator         | Fires                                                                              |
| ----------------- | ---------------------------------------------------------------------------------- |
| `@OnCreate`       | When a message is constructed via `create()`                                       |
| `@OnHydrate`      | After raw transport data is rehydrated, before delivery to a consume callback      |
| `@OnValidate`     | During validation, after the built-in Zod check — throw to reject                  |
| `@BeforePublish`  | Before the transport publishes                                                     |
| `@AfterPublish`   | After the transport confirms publication                                           |
| `@BeforeConsume`  | After deserialisation, before the consume callback                                 |
| `@AfterConsume`   | After the consume callback completes successfully                                  |
| `@OnConsumeError` | When the consume callback throws — receives `(error, message, meta)` (error first) |

```typescript
@OnCreate((msg) => {
  msg.slug = msg.name.toLowerCase().replace(/\s+/g, "-");
})
@OnValidate((msg) => {
  if (msg.startDate >= msg.endDate) throw new Error("startDate must be before endDate");
})
@BeforePublish(async (msg) => {
  await validateExternalId(msg.externalId);
})
@AfterPublish(async (msg) => {
  metrics.increment("messages.published");
})
@BeforeConsume(async (msg) => {
  audit.log("consuming", msg);
})
@AfterConsume(async (msg) => {
  metrics.increment("messages.consumed");
})
@OnConsumeError(async (error, msg) => {
  errorTracker.capture(error, { messageId: msg.id });
})
@Message()
class BookingRequest {
  /* ... */
}
```

## Hook Execution Order

| Phase      | Order                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------- |
| Creation   | `@OnCreate`                                                                                                 |
| Validation | `@OnValidate`                                                                                               |
| Hydration  | `@OnHydrate`                                                                                                |
| Publish    | `@BeforePublish` -> `subscriber.beforePublish` -> transport -> `@AfterPublish` -> `subscriber.afterPublish` |
| Consume    | `@BeforeConsume` -> `subscriber.beforeConsume` -> callback -> `@AfterConsume` -> `subscriber.afterConsume`  |
| Error      | `@OnConsumeError` -> `subscriber.onConsumeError` (replaces the after-consume steps)                         |

## Subscribers

Observe message lifecycle events across every message in a source.

```typescript
import type { IMessageSubscriber } from "@lindorm/iris";

const audit: IMessageSubscriber = {
  beforePublish: async (msg) => {
    auditLog.log("publishing", msg);
  },
  afterConsume: async (msg) => {
    auditLog.log("consumed", msg);
  },
  onConsumeError: async (err, msg) => {
    auditLog.log("consume-failed", { error: err.message, msg });
  },
};

source.addSubscriber(audit);
source.removeSubscriber(audit);
```

## Consume Envelope

Every subscribe/consume callback receives the message and a `ConsumeEnvelope`:

```typescript
import type { ConsumeEnvelope } from "@lindorm/iris";

await bus.subscribe({
  topic: "OrderPlaced",
  callback: async (msg: OrderPlaced, envelope: ConsumeEnvelope) => {
    envelope.topic; // string
    envelope.messageName; // string
    envelope.namespace; // string | null
    envelope.version; // number
    envelope.headers; // Record<string, string>
    envelope.attempt; // number (1 on first delivery, increments on retry)
    envelope.correlationId; // string | null
    envelope.timestamp; // number (unix ms)
  },
});
```

## Message Manipulation

Every publisher, message bus, and worker queue exposes the same instance utilities:

```typescript
const bus = source.messageBus(OrderPlaced);

const msg = bus.create({ orderId: "abc-123", total: 59.99 });
const hydrated = bus.hydrate({ id: "...", orderId: "abc-123", total: 59.99, createdAt: ... });
const copied = bus.copy(msg); // deep clone with a fresh identifier value
bus.validate(msg);            // throws IrisValidationError when invalid
```

`create()` runs default value generation and `@OnCreate` hooks. `hydrate()` reconstructs from raw transport data without regenerating defaults and runs `@OnHydrate` hooks.

## Publish Options

Per-publish overrides for `publish(message, options)`:

```typescript
await bus.publish(msg, {
  delay: 5000, // ms — overrides @Delay
  priority: 8, // 0..10 — overrides @Priority
  expiry: 60000, // ms — overrides @Expiry
  key: "partition-key", // routing/partition key
  headers: { "x-source": "api" }, // additional headers
});
```

## Sessions

`source.session()` returns a lightweight `IIrisSession` that shares the underlying driver connection but carries its own logger, `IrisHookMeta`, and a snapshot of the source's subscribers at the time of cloning. This is the idiomatic way to scope correlation IDs and per-request loggers without tearing down the connection.

```typescript
const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger: appLogger,
  messages: [OrderPlaced],
});

await source.connect();
await source.setup();

const scoped = source.session({
  logger: requestLogger,
  meta: { correlationId: "abc-123", actor: "user:42", timestamp: new Date() },
});

const pub = scoped.publisher(OrderPlaced);
await pub.publish(pub.create({ orderId: "abc", total: 10 }));
```

A session exposes the same `messageBus`, `publisher`, `workerQueue`, `stream`, `rpcClient`, `rpcServer`, `hasMessage`, `ping`, and `driver` surface as the source.

## Driver Configuration

### Memory

```typescript
new IrisSource({ driver: "memory", logger, messages: [OrderPlaced] });
```

### RabbitMQ

```typescript
new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger,
  messages: [OrderPlaced],
  exchange: "my-exchange",
  prefetch: 10,
  connection: {
    heartbeat: 60,
    socketOptions: { timeout: 30000, keepAlive: true },
  },
});
```

### Kafka

```typescript
new IrisSource({
  driver: "kafka",
  brokers: ["localhost:9092"],
  logger,
  messages: [OrderPlaced],
  prefix: "my-app",
  prefetch: 100,
  acks: -1, // -1 = all, 0 = none, 1 = leader
  sessionTimeoutMs: 30000,
  connection: {
    clientId: "my-service",
    ssl: true,
    sasl: { mechanism: "scram-sha-256", username: "user", password: "pass" },
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: { retries: 5, initialRetryTime: 300 },
  },
});
```

### NATS

```typescript
new IrisSource({
  driver: "nats",
  servers: "nats://localhost:4222", // string or Array<string>
  logger,
  messages: [OrderPlaced],
  prefix: "my-app",
  prefetch: 50,
  connection: {
    user: "nats-user",
    pass: "nats-pass",
    tls: true,
    maxReconnectAttempts: 10,
    reconnectTimeWait: 2000,
    timeout: 10000,
    pingInterval: 30000,
    name: "my-service",
  },
});
```

### Redis Streams

```typescript
new IrisSource({
  driver: "redis",
  url: "redis://localhost:6379",
  logger,
  messages: [OrderPlaced],
  prefix: "my-app",
  prefetch: 50,
  blockMs: 5000, // XREAD block time
  maxStreamLength: 10000, // MAXLEN cap per stream
  connection: {
    host: "redis.internal",
    port: 6379,
    password: "secret",
    db: 0,
    tls: {},
    connectTimeout: 10000,
    commandTimeout: 5000,
    keepAlive: 30000,
    connectionName: "iris-worker",
  },
});
```

## Persistence (Delay and Dead Letter Stores)

Configure where delayed deliveries and dead-lettered envelopes are kept. These are used by drivers that don't already provide native primitives for them.

```typescript
new IrisSource({
  driver: "kafka",
  brokers: ["localhost:9092"],
  logger,
  messages: [OrderPlaced],
  persistence: {
    delay: { type: "memory", pollIntervalMs: 250 },
    // delay: { type: "redis", url: "redis://localhost:6379", pollIntervalMs: 250 },
    // delay: { type: "custom", store: myDelayStore },

    deadLetter: { type: "memory" },
    // deadLetter: { type: "redis", url: "redis://localhost:6379" },
    // deadLetter: { type: "custom", store: myDeadLetterStore },
  },
});
```

### Custom Stores

Implement `IDelayStore` and/or `IDeadLetterStore` for bespoke persistence:

```typescript
import type {
  DeadLetterEntry,
  DeadLetterFilterOptions,
  DeadLetterListOptions,
  DelayedEntry,
  IDeadLetterStore,
  IDelayStore,
} from "@lindorm/iris";

class MyDelayStore implements IDelayStore {
  schedule = async (entry: DelayedEntry): Promise<void> => {
    /* ... */
  };
  poll = async (now: number): Promise<Array<DelayedEntry>> => {
    /* ... */
  };
  cancel = async (id: string): Promise<boolean> => {
    /* ... */
  };
  size = async (): Promise<number> => {
    /* ... */
  };
  clear = async (): Promise<void> => {
    /* ... */
  };
  close = async (): Promise<void> => {
    /* ... */
  };
}

class MyDeadLetterStore implements IDeadLetterStore {
  add = async (entry: DeadLetterEntry): Promise<void> => {
    /* ... */
  };
  list = async (options?: DeadLetterListOptions): Promise<Array<DeadLetterEntry>> => {
    /* ... */
  };
  get = async (id: string): Promise<DeadLetterEntry | null> => {
    /* ... */
  };
  remove = async (id: string): Promise<boolean> => {
    /* ... */
  };
  purge = async (options?: DeadLetterFilterOptions): Promise<number> => {
    /* ... */
  };
  count = async (options?: DeadLetterFilterOptions): Promise<number> => {
    /* ... */
  };
  close = async (): Promise<void> => {
    /* ... */
  };
}
```

## Connection State

```typescript
const state = source.getConnectionState();
// "disconnected" | "connecting" | "connected" | "reconnecting" | "draining"

source.on("connection:state", (next) => {
  console.log(`connection state -> ${next}`);
});

source.once("connection:state", (next) => {
  /* ... */
});
source.off("connection:state", listener);

const healthy = await source.ping();
```

## Testing with Mocks

Iris ships per-runtime mock factories. Pick the import path that matches your test runner:

```typescript
// Jest
import {
  createMockIrisSource,
  createMockIrisSession,
  createMockMessageBus,
  createMockPublisher,
  createMockRpcClient,
  createMockWorkerQueue,
} from "@lindorm/iris/mocks/jest";

// Vitest
import {
  createMockIrisSource,
  createMockIrisSession,
  createMockMessageBus,
  createMockPublisher,
  createMockRpcClient,
  createMockWorkerQueue,
} from "@lindorm/iris/mocks/vitest";
```

```typescript
const source = createMockIrisSource();

await source.connect();
expect(source.connect).toHaveBeenCalledTimes(1);

const bus = source.messageBus(OrderPlaced);
const pub = source.publisher(OrderPlaced);
const queue = source.workerQueue(OrderPlaced);
const rpc = source.rpcClient(GetPrice, PriceResponse);
```

The bus, publisher, and worker-queue mocks expose a `published` array and a `clearPublished()` helper. The RPC client mock takes an optional response factory and exposes `requests` plus `clearRequests()`.

```typescript
const pub = createMockPublisher<OrderPlaced>();
await pub.publish(pub.create({ orderId: "abc", total: 10 }));
expect(pub.published).toHaveLength(1);
pub.clearPublished();

const client = createMockRpcClient<GetPrice, PriceResponse>((req) => {
  const res = new PriceResponse();
  res.price = 42.0;
  res.currency = "USD";
  return res;
});
const res = await client.request(new GetPrice());
expect(client.requests).toHaveLength(1);
client.clearRequests();
```

## CLI

The package ships an `iris` binary for scaffolding:

```bash
npx iris init --driver rabbit --directory ./src/iris
npx iris generate message OrderPlaced --directory ./src/iris/messages
```

`iris init` (alias `i`) writes a `source.ts` plus an empty `messages/` directory. `iris generate message` (alias `g m`) writes a single PascalCase-named message file. Both commands accept `--dry-run`.

## Error Classes

Every error extends `IrisError`, which extends `LindormError` from `@lindorm/errors`.

| Error                    | Raised when                                      |
| ------------------------ | ------------------------------------------------ |
| `IrisError`              | Base class — extend for custom errors            |
| `IrisDriverError`        | Driver connection or operation failed            |
| `IrisMetadataError`      | A decorator was used with an invalid value       |
| `IrisNotSupportedError`  | The active driver does not support the operation |
| `IrisPublishError`       | Publishing a message failed                      |
| `IrisScannerError`       | Auto-scanning message classes from disk failed   |
| `IrisSerializationError` | (De)serialisation of an envelope failed          |
| `IrisSourceError`        | Source configuration or lifecycle error          |
| `IrisTimeoutError`       | An operation exceeded its timeout                |
| `IrisTransportError`     | Transport-layer failure                          |
| `IrisValidationError`    | A message failed validation                      |

```typescript
import { IrisTimeoutError } from "@lindorm/iris";

try {
  await client.request(req, { timeout: 1000 });
} catch (error) {
  if (error instanceof IrisTimeoutError) {
    // handle timeout
  }
}
```

## License

AGPL-3.0-or-later
