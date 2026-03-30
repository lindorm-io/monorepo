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

## Message Decorators

### Class-Level

| Decorator            | Description                                            |
| -------------------- | ------------------------------------------------------ |
| `@Message(opts?)`    | Mark class as a message type                           |
| `@AbstractMessage()` | Mark as abstract (non-concrete base)                   |
| `@Namespace(ns)`     | Set message namespace                                  |
| `@Version(n)`        | Set message version (positive integer)                 |
| `@Topic(fn)`         | Dynamic topic resolution callback                      |
| `@Broadcast()`       | Deliver to all subscribers (not just one per queue)    |
| `@Persistent()`      | Mark message as persistent/durable                     |
| `@Priority(n)`       | Set priority (integer 0-10)                            |
| `@Delay(ms)`         | Default delivery delay in milliseconds                 |
| `@Expiry(ms)`        | Message expiration in milliseconds                     |
| `@Encrypted(pred?)`  | Enable payload encryption via `@lindorm/amphora`       |
| `@Compressed(alg?)`  | Enable compression (`"gzip"`, `"deflate"`, `"brotli"`) |
| `@Retry(opts?)`      | Configure retry behaviour on consume failure           |
| `@DeadLetter()`      | Route failed messages to dead letter store             |

### Field-Level

| Decorator              | Description                                                                  |
| ---------------------- | ---------------------------------------------------------------------------- |
| `@Field(type, opts?)`  | Declare field with type and options                                          |
| `@IdentifierField()`   | Auto-generated UUID field                                                    |
| `@CorrelationField()`  | Auto-generated UUID for correlation tracking                                 |
| `@TimestampField()`    | Auto-generated Date field                                                    |
| `@MandatoryField()`    | Boolean field, defaults to `false`                                           |
| `@PersistentField()`   | Boolean persistence flag, defaults to `false`                                |
| `@Generated(strategy)` | Auto-generate value (`"uuid"`, `"date"`, `"string"`, `"integer"`, `"float"`) |
| `@Header(name?)`       | Promote field to message header                                              |
| `@Enum(values)`        | Restrict to enum values                                                      |
| `@Min(n)`              | Minimum value constraint                                                     |
| `@Max(n)`              | Maximum value constraint                                                     |
| `@Schema(zodType)`     | Zod schema validation                                                        |
| `@Transform(opts)`     | Custom serialisation/deserialisation transform                               |

### Lifecycle Hooks

| Decorator             | Description                                     |
| --------------------- | ----------------------------------------------- |
| `@OnCreate(fn)`       | Called when message instance is created         |
| `@OnHydrate(fn)`      | Called when message is rehydrated from raw data |
| `@OnValidate(fn)`     | Called when message is validated                |
| `@BeforePublish(fn)`  | Called before publishing                        |
| `@AfterPublish(fn)`   | Called after publishing                         |
| `@BeforeConsume(fn)`  | Called before consume callback                  |
| `@AfterConsume(fn)`   | Called after successful consume                 |
| `@OnConsumeError(fn)` | Called when consume callback throws             |

## Field Types

The `@Field()` decorator accepts the following type identifiers:

`"array"` | `"bigint"` | `"boolean"` | `"date"` | `"email"` | `"enum"` | `"float"` | `"integer"` | `"object"` | `"string"` | `"url"` | `"uuid"`

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

  @Field("string", { nullable: true }) description!: string | null;
  @Field("string", { optional: true }) nickname?: string;
  @Field("integer", { default: 0 }) retryCount!: number;
  @Field("string", { default: () => "generated" }) code!: string;
}
```

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

**Retry strategies:**

| Strategy        | Delay pattern (base=1000, multiplier=2)     |
| --------------- | ------------------------------------------- |
| `"constant"`    | 1000, 1000, 1000, ...                       |
| `"linear"`      | 1000, 2000, 3000, ...                       |
| `"exponential"` | 1000, 2000, 4000, 8000, ... (capped at max) |

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

**Hook execution order on publish + consume:**

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
const scoped = source.clone({ logger: requestLogger, context: { requestId: "abc" } });

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
