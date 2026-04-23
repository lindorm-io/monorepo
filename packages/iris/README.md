# @lindorm/iris

Unified messaging library for Node.js with a single decorator-driven API across multiple brokers. Define messages once, deploy to any backend.

## Supported Drivers

| Driver       | Peer Dependency | Use Case                            |
| ------------ | --------------- | ----------------------------------- |
| **Memory**   | _(none)_        | Testing, prototyping                |
| **RabbitMQ** | `amqplib`       | Task queues, complex routing        |
| **Kafka**    | `kafkajs`       | High-throughput event streaming     |
| **NATS**     | `nats`          | Low-latency, cloud-native systems   |
| **Redis**    | `ioredis`       | Lightweight streams, existing infra |

Install only the peer dependency for the driver(s) you use:

```bash
npm install @lindorm/iris

# Pick one or more:
npm install amqplib        # RabbitMQ
npm install kafkajs        # Kafka
npm install nats           # NATS
npm install ioredis        # Redis Streams
```

## Quick Start

### 1. Define a Message

```typescript
import {
  Message,
  Namespace,
  Version,
  Field,
  IdentifierField,
  TimestampField,
} from "@lindorm/iris";
import type { IMessage } from "@lindorm/iris";

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

### 2. Create a Source and Connect

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

// Subscribe
await bus.subscribe({
  topic: "OrderPlaced",
  queue: "order-service",
  callback: async (msg, envelope) => {
    console.log(`Order ${msg.orderId} placed for $${msg.total}`);
  },
});

// Publish
const msg = bus.create({ orderId: "abc-123", total: 59.99 });
await bus.publish(msg);
```

### 4. Graceful Shutdown

```typescript
await source.drain();
await source.disconnect();
```

## Table of Contents

- [Messaging Patterns](#messaging-patterns)
  - [Publisher (Fire-and-Forget)](#publisher-fire-and-forget)
  - [Message Bus (Pub/Sub + Queues)](#message-bus-pubsub--queues)
  - [Worker Queue (Competing Consumers)](#worker-queue-competing-consumers)
  - [RPC (Request/Response)](#rpc-requestresponse)
  - [Stream Processor (Pipelines)](#stream-processor-pipelines)
- [Field Types](#field-types)
- [Decorators](#decorators)
  - [Class-Level Decorators](#class-level-decorators)
    - [`@Message`](#message)
    - [`@AbstractMessage`](#abstractmessage)
    - [`@Namespace`](#namespace)
    - [`@Version`](#version)
    - [`@Topic`](#topic)
    - [`@Broadcast`](#broadcast)
    - [`@Persistent`](#persistent)
    - [`@Priority`](#priority)
    - [`@Delay`](#delay)
    - [`@Expiry`](#expiry)
    - [`@Encrypted`](#encrypted)
    - [`@Compressed`](#compressed)
    - [`@Retry`](#retry)
    - [`@DeadLetter`](#deadletter)
  - [Field Decorators](#field-decorators)
    - [`@Field`](#field)
    - [`@IdentifierField`](#identifierfield)
    - [`@CorrelationField`](#correlationfield)
    - [`@TimestampField`](#timestampfield)
    - [`@MandatoryField`](#mandatoryfield)
    - [`@PersistentField`](#persistentfield)
  - [Field Modifiers](#field-modifiers)
    - [`@Generated`](#generated)
    - [`@Header`](#header)
    - [`@Enum`](#enum)
    - [`@Min` / `@Max`](#min--max)
    - [`@Schema`](#schema)
    - [`@Transform`](#transform)
  - [Lifecycle Hook Decorators](#lifecycle-hook-decorators)
    - [`@OnCreate`](#oncreate)
    - [`@OnHydrate`](#onhydrate)
    - [`@OnValidate`](#onvalidate)
    - [`@BeforePublish` / `@AfterPublish`](#beforepublish--afterpublish)
    - [`@BeforeConsume` / `@AfterConsume`](#beforeconsume--afterconsume)
    - [`@OnConsumeError`](#onconsumeerror)
- [Retry and Dead Letter](#retry-and-dead-letter)
- [Dynamic Topics](#dynamic-topics)
- [Encryption and Compression](#encryption-and-compression)
- [Message Subscribers](#message-subscribers)
- [Hook Execution Order](#hook-execution-order)
- [Consume Envelope](#consume-envelope)
- [Message Manipulation](#message-manipulation)
- [Publish Options](#publish-options)
- [Zod Validation](#zod-validation)
- [Cloning](#cloning)
- [Driver Configuration](#driver-configuration)
  - [Memory](#memory)
  - [RabbitMQ](#rabbitmq)
  - [Kafka](#kafka)
  - [NATS](#nats)
  - [Redis Streams](#redis-streams)
- [Persistence (Delay and Dead Letter Stores)](#persistence-delay-and-dead-letter-stores)
- [Connection State](#connection-state)
- [Testing with Mocks](#testing-with-mocks)
- [Error Classes](#error-classes)

## Messaging Patterns

### Publisher (Fire-and-Forget)

Write-only. No subscriptions.

```typescript
const pub = source.publisher(OrderPlaced);

const msg = pub.create({ orderId: "abc-123", total: 59.99 });
await pub.publish(msg);

// Batch publish
await pub.publish([msg1, msg2, msg3]);
```

### Message Bus (Pub/Sub + Queues)

Publish with topic-based subscriptions. Supports broadcast and competing-consumer queues.

```typescript
const bus = source.messageBus(OrderPlaced);

// Broadcast: every subscriber receives every message
await bus.subscribe({
  topic: "OrderPlaced",
  callback: async (msg) => {
    /* ... */
  },
});

// Queue: messages are distributed round-robin among consumers
await bus.subscribe({
  topic: "OrderPlaced",
  queue: "order-processors",
  callback: async (msg) => {
    /* ... */
  },
});

// Multiple subscriptions at once
await bus.subscribe([
  { topic: "OrderPlaced", queue: "analytics", callback: handleAnalytics },
  { topic: "OrderPlaced", queue: "notifications", callback: handleNotify },
]);

// Unsubscribe
await bus.unsubscribe({ topic: "OrderPlaced", queue: "analytics" });
await bus.unsubscribeAll();
```

### Worker Queue (Competing Consumers)

Specialised for job distribution where each message is processed by exactly one consumer.

```typescript
const queue = source.workerQueue(OrderPlaced);

// Register competing consumers
await queue.consume("process-orders", async (msg, envelope) => {
  console.log(`Processing order ${msg.orderId} (attempt ${envelope.attempt})`);
});

// Publish work
await queue.publish(queue.create({ orderId: "abc-123", total: 59.99 }));

// Clean up
await queue.unconsume("process-orders");
await queue.unconsumeAll();
```

### RPC (Request/Response)

Synchronous request/response over the message broker.

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

// Server: register handler
await server.serve(async (req) => {
  const res = new PriceResponse();
  res.price = await lookupPrice(req.sku);
  res.currency = "USD";
  return res;
});

// Client: send request
const req = new GetPrice();
req.sku = "WIDGET-42";

const res = await client.request(req);
console.log(`${res.price} ${res.currency}`); // 29.99 USD

// With timeout
const res2 = await client.request(req, { timeout: 5000 });

// Clean up
await client.close();
await server.unserveAll();
```

### Stream Processor (Pipelines)

Declarative stream processing with an immutable builder pattern.

```typescript
@Message()
class RawEvent {
  @Field("string") type!: string;
  @Field("float") value!: number;
}

@Message()
class AggregatedEvent {
  @Field("float") sum!: number;
  @Field("integer") count!: number;
}

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
// pipeline.isRunning() === true

await pipeline.pause();
await pipeline.resume();
await pipeline.stop();
```

## Field Types

The `@Field()` decorator accepts the following type identifiers:

| Category       | Types                            |
| -------------- | -------------------------------- |
| Boolean        | `boolean`                        |
| Integer        | `integer`, `bigint`              |
| Floating Point | `float`                          |
| String         | `string`, `email`, `url`, `uuid` |
| Enum           | `enum`                           |
| Date/Time      | `date`                           |
| Structured     | `object`, `array`                |

```typescript
@Message()
class FullExample {
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

All decorators use the TC39 (stage 3) decorator specification. Class decorators receive `ClassDecoratorContext`, field decorators receive `ClassFieldDecoratorContext`. Metadata flows through the `Symbol.metadata` prototype chain, so abstract base class decorators are inherited by concrete subclasses.

### Class-Level Decorators

These decorators are applied to classes and configure message-wide behavior.

#### `@Message`

Marks a class as a concrete message type registered in the global message registry. Every message class must have exactly one of `@Message` or `@AbstractMessage`.

```typescript
@Message()
class OrderPlaced {
  /* ... */
}

@Message({ name: "order-placed" }) // custom message name
class OrderPlaced {
  /* ... */
}
```

**Options:** `{ name?: string }` — Override the message name. Defaults to the class name with any trailing version suffix (`_v1`, `_V2`) stripped. Must not conflict with other registered message names.

#### `@AbstractMessage`

Marks a class as an abstract message base. It is **not** registered in the global message registry. Fields, hooks, and metadata are inherited by `@Message()` subclasses via the `Symbol.metadata` prototype chain.

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

Cannot be combined with `@Message` on the same class.

#### `@Namespace`

Places the message in a named namespace for logical grouping and routing.

```typescript
@Namespace("orders")
@Message()
class OrderPlaced {
  /* ... */
}
```

**Argument:** `string` — must be non-empty. Throws `IrisMetadataError` if empty or whitespace-only.

#### `@Version`

Sets the message schema version. Useful for evolving message formats while maintaining backward compatibility.

```typescript
@Version(1)
@Message()
class OrderPlaced {
  /* ... */
}
```

**Argument:** `number` — must be a positive integer (>= 1). Throws `IrisMetadataError` otherwise.

#### `@Topic`

Provides a dynamic topic resolution callback. Instead of using the message class name as the topic, the callback computes the topic from the message content at publish time.

```typescript
@Topic((msg: any) => `events.${msg.region}.${msg.type}`)
@Message()
class RegionalEvent {
  @Field("string") region!: string;
  @Field("string") type!: string;
}
```

**Argument:** `(message: any) => string` — receives the message instance, returns the routing topic string.

#### `@Broadcast`

Marks a message for broadcast delivery. When published, the message is delivered to **all** subscribers rather than being distributed round-robin to one consumer per queue.

```typescript
@Broadcast()
@Message()
class SystemNotification {
  @Field("string") text!: string;
}
```

No arguments.

#### `@Persistent`

Marks a message as persistent/durable. Persistent messages survive broker restarts (where supported by the driver).

```typescript
@Persistent()
@Message()
class PaymentCharge {
  @Field("string") chargeId!: string;
}
```

No arguments.

#### `@Priority`

Sets the default priority for a message type. Higher priority messages are delivered before lower priority ones (where supported by the driver).

```typescript
@Priority(8)
@Message()
class UrgentAlert {
  @Field("string") text!: string;
}
```

**Argument:** `number` — integer between 0 and 10 inclusive. Throws `IrisMetadataError` if out of range or not an integer.

#### `@Delay`

Sets a default delivery delay. The message is held for the specified duration before being delivered to consumers.

```typescript
@Delay(5000) // 5 seconds
@Message()
class ScheduledReminder {
  @Field("string") text!: string;
}
```

**Argument:** `number` — non-negative integer in milliseconds. Throws `IrisMetadataError` if negative or not an integer.

Can be overridden per-publish via `PublishOptions.delay`.

#### `@Expiry`

Sets a default message TTL (time-to-live). Messages that are not consumed within this window are discarded.

```typescript
@Expiry(60000) // 1 minute
@Message()
class TemporaryOffer {
  @Field("float") discount!: number;
}
```

**Argument:** `number` — non-negative integer in milliseconds. Throws `IrisMetadataError` if negative or not an integer.

Can be overridden per-publish via `PublishOptions.expiry`.

#### `@Encrypted`

Enables payload encryption via `@lindorm/amphora`. The entire message payload is encrypted before publishing and decrypted on consume. Requires an `IAmphora` instance configured on `IrisSource`.

```typescript
@Encrypted() // encrypt with any available key
@Message()
class SensitivePayload {
  @Field("string") ssn!: string;
}

@Encrypted({ purpose: "pii" }) // filter keys by purpose
@Message()
class MedicalRecord {
  @Field("json") data!: Record<string, unknown>;
}
```

**Argument:** `AmphoraPredicate` (optional, defaults to `{}`) — a predicate object to filter which encryption key to use from the key store. Supports fields like `algorithm`, `encryption`, `purpose`, `type`, `ownerId`, and standard predicate operators (`$eq`, `$in`, `$neq`, etc.).

#### `@Compressed`

Enables payload compression before publishing and decompression on consume.

```typescript
@Compressed() // gzip (default)
@Compressed("brotli") // brotli compression
@Message()
class LargePayload {
  @Field("object") data!: Record<string, unknown>;
}
```

**Argument:** `"gzip" | "deflate" | "brotli"` (optional, defaults to `"gzip"`).

When combined with `@Encrypted`, compression is applied first, then encryption.

#### `@Retry`

Configures automatic retry behavior when a consume callback throws. Failed messages are retried with configurable backoff strategies.

```typescript
@Retry() // defaults: 3 retries, constant 1s delay
@Message()
class ProcessOrder {
  @Field("string") orderId!: string;
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
  @Field("string") chargeId!: string;
}
```

**Options:**

| Field        | Type                                          | Default      | Description                               |
| ------------ | --------------------------------------------- | ------------ | ----------------------------------------- |
| `maxRetries` | `number`                                      | `3`          | Maximum number of retry attempts          |
| `strategy`   | `"constant"` \| `"linear"` \| `"exponential"` | `"constant"` | Backoff strategy                          |
| `delay`      | `number`                                      | `1000`       | Initial delay in milliseconds             |
| `delayMax`   | `number`                                      | `30000`      | Maximum delay cap in milliseconds         |
| `multiplier` | `number`                                      | `2`          | Multiplier for exponential backoff        |
| `jitter`     | `boolean`                                     | `false`      | Add randomness to prevent thundering herd |

**Retry strategies:**

| Strategy        | Delay pattern (base=1000, multiplier=2)     |
| --------------- | ------------------------------------------- |
| `"constant"`    | 1000, 1000, 1000, ...                       |
| `"linear"`      | 1000, 2000, 3000, ...                       |
| `"exponential"` | 1000, 2000, 4000, 8000, ... (capped at max) |

#### `@DeadLetter`

Routes messages that have exhausted all retry attempts to the dead letter store. Requires `@Retry` and a dead letter store configured via `IrisSource.persistence.deadLetter`.

```typescript
@Retry({ maxRetries: 3 })
@DeadLetter()
@Message()
class PaymentCharge {
  @Field("string") chargeId!: string;
}
```

No arguments.

---

### Field Decorators

These decorators are applied to class properties and declare message fields. Each field decorator creates a complete field definition with its type, default value, and nullability.

#### `@Field`

The foundational field decorator. Declares a message field with an explicit type.

```typescript
@Field("string")
name!: string;

@Field("integer")
count!: number;

@Field("float")
price!: number;

@Field("boolean")
active!: boolean;

@Field("date")
expiresAt!: Date;

@Field("uuid")
referenceId!: string;

@Field("email")
contactEmail!: string;

@Field("url")
callbackUrl!: string;

@Field("array")
tags!: Array<string>;

@Field("object")
metadata!: Record<string, unknown>;
```

**Arguments:** `(type: MetaFieldType)`.

Modifiers (nullable, optional, default value, transform) are expressed as stackable decorators applied above `@Field`. See the modifier sections below.

```typescript
@Nullable()
@Field("string")
description!: string | null;

@Optional()
@Field("string")
nickname?: string;

@Default(0)
@Field("integer")
retryCount!: number;

@Default(() => "generated")
@Field("string")
code!: string;

@Transform({
  to: (value: unknown) => Math.round((value as number) * 100),
  from: (raw: unknown) => (raw as number) / 100,
})
@Field("float")
price!: number;
```

#### `@IdentifierField`

Shorthand for a UUID primary identifier field. Auto-generates a UUID v4 on message creation.

```typescript
@IdentifierField()
id!: string;
```

Equivalent to `@Default(() => randomUUID()) @Field("uuid")`. Non-nullable, non-optional.

No arguments.

#### `@CorrelationField`

Shorthand for a UUID correlation tracking field. Auto-generates a UUID v4 on message creation. Used to trace related messages across publish/consume chains.

```typescript
@CorrelationField()
correlationId!: string;
```

Equivalent to `@Default(() => randomUUID()) @Field("uuid")`. Non-nullable, non-optional.

No arguments.

#### `@TimestampField`

Shorthand for a timestamp field. Auto-generates the current `Date` on message creation.

```typescript
@TimestampField()
createdAt!: Date;
```

Equivalent to `@Default(() => new Date()) @Field("date")`. Non-nullable, non-optional.

No arguments.

#### `@MandatoryField`

Shorthand for a boolean flag that defaults to `false`. Commonly used for acknowledgement or processing flags.

```typescript
@MandatoryField()
requiresApproval!: boolean;
```

Equivalent to `@Default(false) @Field("boolean")`. Non-nullable, non-optional.

No arguments.

#### `@PersistentField`

Shorthand for a boolean persistence flag that defaults to `false`. Commonly used to mark whether a message should be durably stored.

```typescript
@PersistentField()
shouldPersist!: boolean;
```

Equivalent to `@Default(false) @Field("boolean")`. Non-nullable, non-optional.

No arguments.

---

### Field Modifiers

These decorators modify the behavior of a field declared with `@Field` or one of the shorthand field decorators. Stack them on the same property. Modifier decorators must appear alongside a field decorator on the same property.

#### `@Generated`

Marks a field for automatic value generation on message creation.

```typescript
@Generated("uuid")                   // UUID v4
@Field("uuid")
traceId!: string;

@Generated("date")                   // current timestamp
@Field("date")
processedAt!: Date;

@Generated("string")                 // random string (default length)
@Field("string")
token!: string;

@Generated("string", { length: 12 }) // random string with custom length
@Field("string")
shortCode!: string;

@Generated("integer", { min: 1, max: 1000 })
@Field("integer")
sequenceNumber!: number;

@Generated("float", { min: 0.0, max: 1.0 })
@Field("float")
weight!: number;
```

**Arguments:** `(strategy: MetaGeneratedStrategy, options?: GeneratedDecoratorOptions)`.

**Strategies:**

| Strategy    | Description                              |
| ----------- | ---------------------------------------- |
| `"uuid"`    | Generate UUID v4                         |
| `"date"`    | Current timestamp                        |
| `"string"`  | Random string with configurable `length` |
| `"integer"` | Random integer in `[min, max]` range     |
| `"float"`   | Random float in `[min, max]` range       |

**Options:** `{ length?: number, min?: number, max?: number }` — all optional, all default to `null`.

#### `@Header`

Promotes a field value to a message header. Headers are transported as key-value metadata alongside the payload, accessible without deserialising the full message body.

```typescript
@Header()              // header name = property name ("source")
@Field("string")
source!: string;

@Header("x-trace-id") // explicit header name
@Field("uuid")
traceId!: string;
```

**Argument:** `string?` — custom header name. Defaults to the property name. Throws `IrisMetadataError` if the resolved name is empty or whitespace-only.

#### `@Enum`

Restricts a field to a fixed set of allowed values. Pass a TypeScript enum or a plain `Record<string, string | number>`. Enforced during Zod validation.

```typescript
enum OrderStatus {
  Pending = "pending",
  Shipped = "shipped",
  Delivered = "delivered",
}

@Enum(OrderStatus)
@Field("enum")
status!: OrderStatus;
```

**Argument:** `Record<string, string | number>` — the enum object or value map.

#### `@Min` / `@Max`

Set minimum/maximum bounds for numeric fields or minimum/maximum length for string fields. Enforced during Zod validation.

```typescript
@Min(0)
@Max(100)
@Field("integer")
score!: number;

@Min(1)
@Max(255)
@Field("string")
name!: string;
```

**Argument:** `number`.

#### `@Schema`

Attaches a Zod schema for fine-grained field validation. The schema is evaluated during message validation.

```typescript
import { z } from "zod";

@Schema(z.string().email())
@Field("email")
email!: string;

@Schema(z.number().int().min(13).max(150))
@Field("integer")
age!: number;

@Schema(z.string().regex(/^[A-Z]{2,3}$/))
@Field("string")
countryCode!: string;
```

**Argument:** `z.ZodType` — any Zod schema.

#### `@Transform`

Applies a bidirectional transform to a field value. `to` runs during serialisation (message -> transport), `from` runs during deserialisation (transport -> message).

```typescript
@Transform({
  to: (value: string[]) => value.join(","),
  from: (raw: string) => raw.split(","),
})
@Field("string")
tags!: string[];

@Transform<Date, number>({
  to: (date) => date.getTime(),
  from: (ms) => new Date(ms),
})
@Field("bigint")
timestamp!: Date;
```

**Options:** `{ to: (value: TFrom) => TTo, from: (raw: TTo) => TFrom }`.

This is a standalone decorator that uses a separate staging path. For inline transforms, use the `transform` option on `@Field` instead.

---

### Lifecycle Hook Decorators

Lifecycle hooks are **class decorators** that register callbacks at specific points in the message lifecycle. All hooks receive `(message, meta)` as arguments, where `meta` is an `IrisHookMeta` carrying request-scoped metadata (`correlationId`, `actor`, `timestamp`).

Hooks may be async (`void | Promise<void>`) unless otherwise noted.

#### `@OnCreate`

Fires when a message instance is created via `create()`. Useful for setting computed defaults or derived fields.

```typescript
@OnCreate((msg) => {
  msg.slug = msg.name.toLowerCase().replace(/\s+/g, "-");
})
@Message()
class OrderPlaced {
  @Field("string") name!: string;
  @Field("string") slug!: string;
}
```

**Argument:** `(message: M, meta: IrisHookMeta) => void | Promise<void>`.

#### `@OnHydrate`

Fires when a message is rehydrated from raw transport data, after all fields are populated but before the message is returned to the consume callback.

```typescript
@OnHydrate((msg) => {
  msg.displayName = `${msg.firstName} ${msg.lastName}`;
})
@Message()
class UserEvent {
  @Field("string") firstName!: string;
  @Field("string") lastName!: string;
  @Field("string") displayName!: string;
}
```

**Argument:** `(message: M, meta: IrisHookMeta) => void | Promise<void>`.

#### `@OnValidate`

Fires during message validation, after the built-in Zod schema check. Throw to reject the message.

```typescript
@OnValidate((msg) => {
  if (msg.startDate >= msg.endDate) {
    throw new Error("startDate must be before endDate");
  }
})
@Message()
class BookingRequest {
  @Field("date") startDate!: Date;
  @Field("date") endDate!: Date;
}
```

**Argument:** `(message: M, meta: IrisHookMeta) => void | Promise<void>`.

#### `@BeforePublish` / `@AfterPublish`

Fire around publish operations. `@BeforePublish` runs before the message is handed to the transport. `@AfterPublish` runs after the transport confirms delivery.

```typescript
@BeforePublish(async (msg) => {
  await validateExternalId(msg.externalId);
})
@AfterPublish(async (msg) => {
  metrics.increment("messages.published");
})
@Message()
class OrderPlaced {
  @Field("string") externalId!: string;
}
```

**Argument:** `(message: M, meta: IrisHookMeta) => void | Promise<void>`.

#### `@BeforeConsume` / `@AfterConsume`

Fire around consume callback execution. `@BeforeConsume` runs after deserialisation but before the consume callback. `@AfterConsume` runs after the callback completes successfully.

```typescript
@BeforeConsume(async (msg, ctx) => {
  audit.log("consuming", msg);
})
@AfterConsume(async (msg) => {
  metrics.increment("messages.consumed");
})
@Message()
class OrderPlaced {
  /* ... */
}
```

**Argument:** `(message: M, meta: IrisHookMeta) => void | Promise<void>`.

#### `@OnConsumeError`

Fires when a consume callback throws an error. Receives the error as the **first** argument, followed by the message and meta.

```typescript
@OnConsumeError(async (error, msg) => {
  errorTracker.capture(error, { messageId: msg.id });
})
@Message()
class PaymentCharge {
  @IdentifierField() id!: string;
  @Field("string") chargeId!: string;
}
```

**Argument:** `(error: Error, message: M, meta: IrisHookMeta) => void | Promise<void>`.

Note the different signature: `error` is the first parameter, unlike all other hooks where the message comes first.

---

### Hook Execution Order

| Phase      | Hooks (in order)                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| Creation   | `@OnCreate`                                                                                             |
| Validation | `@OnValidate`                                                                                           |
| Publish    | `@BeforePublish` -> subscriber.beforePublish -> transport -> `@AfterPublish` -> subscriber.afterPublish |
| Consume    | `@BeforeConsume` -> subscriber.beforeConsume -> callback -> `@AfterConsume` -> subscriber.afterConsume  |
| Hydration  | `@OnHydrate`                                                                                            |
| Error      | `@OnConsumeError` -> subscriber.onConsumeError (replaces AfterConsume steps)                            |

Full publish + consume lifecycle:

```
1. @BeforePublish hook
2. subscriber.beforePublish
3. (transport publishes)
4. (transport delivers to consumer)
5. @BeforeConsume hook
6. subscriber.beforeConsume
7. callback executes
8. @AfterConsume hook
9. subscriber.afterConsume
10. @AfterPublish hook
11. subscriber.afterPublish
```

On error at step 7, steps 8-11 are replaced by `@OnConsumeError` and `subscriber.onConsumeError`.

## Retry and Dead Letter

Configure automatic retry with backoff strategies and dead letter routing for permanently failed messages.

```typescript
@Retry({
  maxRetries: 5,
  strategy: "exponential", // "constant" | "linear" | "exponential"
  delay: 1000, // initial delay in ms
  delayMax: 30000, // maximum delay cap
  multiplier: 2, // exponential multiplier
  jitter: true, // add randomness to prevent thundering herd
})
@DeadLetter()
@Message()
class PaymentCharge {
  @Field("string") chargeId!: string;
  @Field("float") amount!: number;
}
```

## Dynamic Topics

Route messages to different topics based on their content:

```typescript
@Topic((msg: any) => `events.${msg.region}.${msg.type}`)
@Message()
class RegionalEvent {
  @Field("string") region!: string;
  @Field("string") type!: string;
  @Field("object") data!: Record<string, unknown>;
}

const bus = source.messageBus(RegionalEvent);
const msg = bus.create({ region: "eu-west", type: "signup", data: {} });
await bus.publish(msg); // Published to "events.eu-west.signup"
```

## Encryption and Compression

```typescript
import { Encrypted, Compressed } from "@lindorm/iris";

@Encrypted() // Encrypt payload via amphora
@Compressed("brotli") // Then compress ("gzip" | "deflate" | "brotli")
@Message()
class SensitivePayload {
  @Field("string") ssn!: string;
  @Field("string") name!: string;
}

// Source must be configured with an amphora instance
const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger: myLogger,
  amphora: myAmphora,
  messages: [SensitivePayload],
});
```

## Message Subscribers

Observe message lifecycle events across all messages in a source:

```typescript
import type { IMessageSubscriber } from "@lindorm/iris";

const auditSubscriber: IMessageSubscriber = {
  beforePublish: async (msg) => {
    audit.log("publishing", msg);
  },
  afterConsume: async (msg) => {
    audit.log("consumed", msg);
  },
  onConsumeError: async (error, msg) => {
    audit.log("consume-failed", { error: error.message, msg });
  },
};

source.addSubscriber(auditSubscriber);

// Remove later
source.removeSubscriber(auditSubscriber);
```

## Consume Envelope

Every subscribe/consume callback receives the message and an envelope with routing metadata:

```typescript
import type { ConsumeEnvelope } from "@lindorm/iris";

await bus.subscribe({
  topic: "OrderPlaced",
  callback: async (msg: OrderPlaced, envelope: ConsumeEnvelope) => {
    console.log(envelope.topic); // "OrderPlaced"
    console.log(envelope.messageName); // "OrderPlaced"
    console.log(envelope.namespace); // "orders" | null
    console.log(envelope.version); // 1
    console.log(envelope.headers); // Record<string, string>
    console.log(envelope.attempt); // 1 (increments on retry)
    console.log(envelope.correlationId); // string | null
    console.log(envelope.timestamp); // Unix timestamp
  },
});
```

## Message Manipulation

Every publisher, message bus, and worker queue provides utilities for working with message instances:

```typescript
const bus = source.messageBus(OrderPlaced);

// Create: new instance with auto-generated fields and defaults
const msg = bus.create({ orderId: "abc-123", total: 59.99 });

// Hydrate: reconstruct from raw data (no auto-generation)
const hydrated = bus.hydrate({ orderId: "abc-123", total: 59.99, id: "existing-uuid" });

// Copy: deep clone with a fresh identifier
const copied = bus.copy(msg);
// copied.orderId === msg.orderId, but copied.id !== msg.id

// Validate: throws IrisValidationError if invalid
bus.validate(msg);
```

## Publish Options

Override message-level defaults per publish call:

```typescript
await bus.publish(msg, {
  delay: 5000, // delay delivery by 5 seconds
  priority: 8, // override @Priority
  expiry: 60000, // override @Expiry (TTL in ms)
  key: "partition-key", // routing/partition key
  headers: { "x-source": "api" }, // additional headers
});
```

## Zod Validation

Use `@Schema()` with Zod for fine-grained field validation:

```typescript
import { z } from "zod";
import { Schema, Field, Message } from "@lindorm/iris";

@Message()
class UserCreated {
  @Schema(z.string().email())
  @Field("email")
  email!: string;

  @Schema(z.number().int().min(13).max(150))
  @Field("integer")
  age!: number;

  @Schema(z.string().regex(/^[A-Z]{2,3}$/))
  @Field("string")
  countryCode!: string;
}
```

## Cloning

Create independent source instances that share the underlying driver connection:

```typescript
const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger: mainLogger,
  messages: [OrderPlaced],
});

await source.connect();
await source.setup();

// Clone shares the connection but has its own logger and subscriber registry
const scoped = source.session({
  logger: requestLogger,
  meta: { correlationId: "abc", actor: "unknown", timestamp: new Date() },
});

const pub = scoped.publisher(OrderPlaced);
await pub.publish(pub.create({ orderId: "abc-123", total: 59.99 }));
```

## Driver Configuration

### Memory

```typescript
const source = new IrisSource({
  driver: "memory",
  logger,
  messages: [OrderPlaced],
});
```

### RabbitMQ

```typescript
const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger,
  messages: [OrderPlaced],
  exchange: "my-exchange", // optional
  prefetch: 10, // optional
  connection: {
    // optional
    heartbeat: 60,
    socketOptions: {
      timeout: 30000,
      keepAlive: true,
    },
  },
});
```

### Kafka

```typescript
const source = new IrisSource({
  driver: "kafka",
  brokers: ["localhost:9092"],
  logger,
  messages: [OrderPlaced],
  prefix: "my-app", // optional topic prefix
  prefetch: 100, // optional
  acks: -1, // optional: -1 (all), 0 (none), 1 (leader)
  sessionTimeoutMs: 30000, // optional
  connection: {
    // optional
    clientId: "my-service",
    ssl: true,
    sasl: {
      mechanism: "scram-sha-256",
      username: "user",
      password: "pass",
    },
    connectionTimeout: 10000,
    requestTimeout: 30000,
    retry: {
      retries: 5,
      initialRetryTime: 300,
    },
  },
});
```

### NATS

```typescript
const source = new IrisSource({
  driver: "nats",
  servers: "nats://localhost:4222", // string or Array<string>
  logger,
  messages: [OrderPlaced],
  prefix: "my-app", // optional
  prefetch: 50, // optional
  connection: {
    // optional
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
const source = new IrisSource({
  driver: "redis",
  url: "redis://localhost:6379",
  logger,
  messages: [OrderPlaced],
  prefix: "my-app", // optional
  prefetch: 50, // optional
  blockMs: 5000, // optional: XREAD block time
  maxStreamLength: 10000, // optional: MAXLEN cap per stream
  connection: {
    // optional
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

Configure where delayed messages and dead letter entries are stored:

```typescript
const source = new IrisSource({
  driver: "rabbit",
  url: "amqp://localhost",
  logger,
  messages: [OrderPlaced],
  persistence: {
    // Delay store: holds messages until their scheduled delivery time
    delay: { type: "memory" },
    // or: { type: "redis", url: "redis://localhost:6379" },
    // or: { type: "custom", store: myDelayStore },

    // Dead letter store: holds messages that exhausted all retries
    deadLetter: { type: "memory" },
    // or: { type: "redis", url: "redis://localhost:6379" },
    // or: { type: "custom", store: myDeadLetterStore },
  },
});
```

### Custom Stores

Implement `IDelayStore` and/or `IDeadLetterStore` for custom persistence:

```typescript
import type {
  IDelayStore,
  IDeadLetterStore,
  DelayedEntry,
  DeadLetterEntry,
} from "@lindorm/iris";

class MyDelayStore implements IDelayStore {
  async schedule(entry: DelayedEntry): Promise<void> {
    /* ... */
  }
  async poll(now: number): Promise<Array<DelayedEntry>> {
    /* ... */
  }
  async cancel(id: string): Promise<boolean> {
    /* ... */
  }
  async size(): Promise<number> {
    /* ... */
  }
  async clear(): Promise<void> {
    /* ... */
  }
  async close(): Promise<void> {
    /* ... */
  }
}

class MyDeadLetterStore implements IDeadLetterStore {
  async add(entry: DeadLetterEntry): Promise<void> {
    /* ... */
  }
  async list(options?: {
    topic?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<DeadLetterEntry>> {
    /* ... */
  }
  async get(id: string): Promise<DeadLetterEntry | null> {
    /* ... */
  }
  async remove(id: string): Promise<boolean> {
    /* ... */
  }
  async purge(options?: { topic?: string }): Promise<number> {
    /* ... */
  }
  async count(options?: { topic?: string }): Promise<number> {
    /* ... */
  }
  async close(): Promise<void> {
    /* ... */
  }
}
```

## Connection State

```typescript
const state = source.getConnectionState();
// "disconnected" | "connecting" | "connected" | "reconnecting" | "draining"

source.onConnectionStateChange((state) => {
  console.log(`Connection state: ${state}`);
});

// Health check
const healthy = await source.ping();
```

## Testing with Mocks

All mocks are available via the `@lindorm/iris/mocks` subpath:

```typescript
import {
  createMockIrisSource,
  createMockPublisher,
  createMockMessageBus,
  createMockWorkerQueue,
  createMockRpcClient,
} from "@lindorm/iris/mocks";
```

### Mock Source

```typescript
const source = createMockIrisSource();

// All methods are jest.fn() mocks
expect(source.connect).not.toHaveBeenCalled();

await source.connect();
expect(source.connect).toHaveBeenCalledTimes(1);

// Factory methods return mocks by default
const bus = source.messageBus(OrderPlaced);
const pub = source.publisher(OrderPlaced);
const queue = source.workerQueue(OrderPlaced);
const rpc = source.rpcClient(GetPrice, PriceResponse);
```

### Mock Publisher

```typescript
const pub = createMockPublisher<OrderPlaced>();

const msg = pub.create({ orderId: "abc", total: 10 });
await pub.publish(msg);

// Inspect published messages
expect(pub.published).toHaveLength(1);

// Reset
pub.clearPublished();
expect(pub.published).toHaveLength(0);
```

### Mock Message Bus

```typescript
const bus = createMockMessageBus<OrderPlaced>();

await bus.publish(bus.create({ orderId: "abc", total: 10 }));

expect(bus.published).toHaveLength(1);
expect(bus.subscribe).not.toHaveBeenCalled();

bus.clearPublished();
```

### Mock Worker Queue

```typescript
const queue = createMockWorkerQueue<OrderPlaced>();

await queue.publish(queue.create({ orderId: "abc", total: 10 }));

expect(queue.published).toHaveLength(1);
expect(queue.consume).not.toHaveBeenCalled();

queue.clearPublished();
```

### Mock RPC Client

```typescript
// Provide a response factory
const client = createMockRpcClient<GetPrice, PriceResponse>((req) => {
  const res = new PriceResponse();
  res.price = 42.0;
  res.currency = "USD";
  return res;
});

const req = new GetPrice();
req.sku = "WIDGET-42";

const res = await client.request(req);
expect(res.price).toBe(42.0);
expect(client.requests).toHaveLength(1);

client.clearRequests();
```

## Error Classes

All errors extend `IrisError`, which extends `LindormError`:

| Error Class              | When                                      |
| ------------------------ | ----------------------------------------- |
| `IrisError`              | Base class for all iris errors            |
| `IrisDriverError`        | Driver connection or operation failure    |
| `IrisMetadataError`      | Invalid decorator configuration           |
| `IrisNotSupportedError`  | Unsupported feature for the active driver |
| `IrisPublishError`       | Message publishing failure                |
| `IrisScannerError`       | Message class scanning failure            |
| `IrisSerializationError` | Serialisation or deserialisation failure  |
| `IrisSourceError`        | Source setup or configuration error       |
| `IrisTimeoutError`       | Operation exceeded timeout                |
| `IrisTransportError`     | Transport layer failure                   |
| `IrisValidationError`    | Message validation failure                |

```typescript
import { IrisTimeoutError, IrisValidationError } from "@lindorm/iris";

try {
  await client.request(req, { timeout: 1000 });
} catch (error) {
  if (error instanceof IrisTimeoutError) {
    // handle timeout
  }
}
```

## Full Example

```typescript
import {
  IrisSource,
  Message,
  Namespace,
  Version,
  Field,
  IdentifierField,
  TimestampField,
  Retry,
  DeadLetter,
} from "@lindorm/iris";
import type { IMessage, IMessageSubscriber } from "@lindorm/iris";

// --- Define messages ---

@Message()
@Namespace("payments")
@Version(1)
@Retry({ maxRetries: 3, strategy: "exponential", delay: 1000 })
@DeadLetter()
class ChargeRequested {
  @IdentifierField() id!: string;
  @TimestampField() createdAt!: Date;
  @Field("string") paymentId!: string;
  @Field("float") amount!: number;
  @Field("string") currency!: string;
}

@Message()
@Namespace("payments")
@Version(1)
class ChargeCompleted {
  @IdentifierField() id!: string;
  @TimestampField() completedAt!: Date;
  @Field("string") paymentId!: string;
  @Field("boolean") success!: boolean;
}

// --- Set up source ---

const source = new IrisSource({
  driver: "kafka",
  brokers: ["kafka-1:9092", "kafka-2:9092"],
  logger: appLogger,
  messages: [ChargeRequested, ChargeCompleted],
  persistence: {
    deadLetter: { type: "redis", url: "redis://localhost:6379" },
  },
});

await source.connect();
await source.setup();

// --- Observe lifecycle ---

const metricsSubscriber: IMessageSubscriber = {
  afterPublish: async (msg) => metrics.increment("messages.published"),
  afterConsume: async (msg) => metrics.increment("messages.consumed"),
  onConsumeError: async (err) => metrics.increment("messages.errors"),
};

source.addSubscriber(metricsSubscriber);

// --- Worker: process charges ---

const queue = source.workerQueue(ChargeRequested);
const completedPub = source.publisher(ChargeCompleted);

await queue.consume("payment-workers", async (msg, envelope) => {
  const result = await paymentGateway.charge(msg.paymentId, msg.amount, msg.currency);

  const completed = completedPub.create({
    paymentId: msg.paymentId,
    success: result.ok,
  });

  await completedPub.publish(completed);
});

// --- Notify on completion ---

const completedBus = source.messageBus(ChargeCompleted);

await completedBus.subscribe({
  topic: "ChargeCompleted",
  queue: "notification-service",
  callback: async (msg) => {
    if (msg.success) {
      await emailService.sendReceipt(msg.paymentId);
    }
  },
});

// --- Shutdown ---

process.on("SIGTERM", async () => {
  await source.drain();
  await source.disconnect();
});
```

## License

AGPL-3.0-or-later
