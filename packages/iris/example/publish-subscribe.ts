// @lindorm/logger and zod are required peer dependencies. The memory driver needs
// no broker client; every other driver has its own peer (amqplib, kafkajs, nats,
// ioredis).
import { IrisSource } from "../src/index.js";
import { Logger } from "@lindorm/logger";
import { OrderPlaced } from "./messages/OrderPlaced.js";

const source = new IrisSource({
  driver: "memory",
  logger: new Logger({ level: "warn", readable: true }),
  messages: [OrderPlaced],
});

await source.connect();
await source.setup();

const bus = source.messageBus(OrderPlaced);

// @Namespace is prefixed onto the topic the message publishes to.
const topic = "orders.OrderPlaced";

await bus.subscribe({
  topic,
  queue: "order-service",
  callback: async (message, envelope) => {
    console.log("consumed > ", message.orderId, message.currency, envelope.attempt);
  },
});

const order = bus.create({
  orderId: "ord_7Kq4mN",
  customerEmail: "buyer@example.com",
  total: 59.99,
  lineCount: 2,
  skus: ["WIDGET-42", "GADGET-7"],
  attributes: { channel: "web" },
  couponCode: null,
});

bus.validate(order);

console.log("driver       > ", source.driver);
console.log("capabilities > ", source.capabilities.broadcast, source.capabilities.retry);
console.log("state        > ", source.getConnectionState());
console.log("created      > ", order.id, order.correlationId, order.createdAt);

await bus.publish(order, { headers: { "x-example": "publish-subscribe" } });

await bus.unsubscribe({ topic, queue: "order-service" });
await source.drain();
await source.disconnect();
