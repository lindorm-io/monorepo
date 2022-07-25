# @lindorm-io/amqp

AMQP connection and message bus for lindorm.io packages.

## Installation

```shell script
npm install --save @lindorm-io/mongo
```

## Usage

### AMQP Connection

```typescript
const connection = new AmqpConnection({
  hostname: "amqp.location.com",
  port: 5672,
});

await connection.connect();
```

### Message Bus

```typescript
const messageBus = new MessageBus({
  connection,
  logger,
});

const callback = async () => {};

await messageBus.subscribe([
  { callback, queue: "1", routingKey: "default.1" },
  { callback, queue: "2", routingKey: "default.2" },
]);

await messageBus.publish([
  {
    id: randomUUID(),
    delay: 0,
    mandatory: true,
    routingKey: "default.1",
    type: "type",
  },
]);
```
