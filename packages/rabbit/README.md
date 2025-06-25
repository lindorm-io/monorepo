# @lindorm/rabbit

Opinionated yet flexible **RabbitMQ wrapper** that turns raw AMQP messages into typed classes with
automatic (de)serialisation, retry handling and dead-lettering.  The library is built around a
single `RabbitSource` which owns the connection / channels and lazy-creates `RabbitMessageBus`
instances for each message class.

---

## Features

* Connection **retry loop** – waits for Rabbit to come online when running inside Docker Compose
* Strong typing – message payloads & headers are validated before publish
* Automatic **dead-letter routing** (configurable exchange + queue)
* Shared confirm channel that guarantees at-least-once delivery
* Simple subscription system with **nack timeout** to requeue stuck messages
* Integrates with `@lindorm/logger` for rich, correlated log lines

---

## Installation

```bash
npm install @lindorm/rabbit
# or
yarn add @lindorm/rabbit
```

A ready-made docker compose file can be found next to the package for local testing:

```bash
docker compose -f ./packages/rabbit/docker-compose.yml up -d
```

---

## Basic usage

```ts
import { RabbitSource } from '@lindorm/rabbit';
import { Logger } from '@lindorm/logger';

class UserCreatedMessage {
  constructor(public readonly id: string, public readonly name: string) {}
}

const source = new RabbitSource({
  url: 'amqp://guest:guest@localhost:5672',
  messages: [UserCreatedMessage],
  logger: new Logger({ readable: true }),
});

await source.setup();

const bus = source.messageBus(UserCreatedMessage);

await bus.publish(new UserCreatedMessage('u1', 'Alice'));

bus.subscribe(async (ctx) => {
  console.log('received', ctx.message);
});
```

---

## API glimpse

### `RabbitSource`

```ts
new RabbitSource({
  url?: string;                   // convenience wrapper
  config?: Options.Connect,       // forwarded to amqplib
  messages?: Array<Constructor>,  // classes with .create / .validate helpers (optional)
  logger: ILogger;                // required
  exchange?: string;              // default 'exchange'
  deadletters?: string;           // default 'deadletters'
  nackTimeout?: number;           // ms before unacked delivery is requeued (default 3000)
});

source.setup();
source.connect();
source.disconnect();

source.messageBus(Message, opts?) → RabbitMessageBus
source.clone({ logger? }) → RabbitSource // shares connection / channels
```

### `RabbitMessageBus`

* `publish(message, options?)` – returns delivery confirmation
* `subscribe(handler)` – consume messages (auto-ack / nack on throw)
* `assert(message)` – throws if not valid according to `.validate`

---

## TypeScript

All buses and context objects are fully typed. Messages can expose `.create()` and `.validate()`
helpers to ensure payload integrity.

---

## License

AGPL-3.0-or-later – see the root [`LICENSE`](../../LICENSE).

