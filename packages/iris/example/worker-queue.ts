import { IrisSource } from "../src/index.js";
import { Logger } from "@lindorm/logger";
import { OrderShipped } from "./messages/OrderShipped.js";

const source = new IrisSource({
  driver: "memory",
  logger: new Logger({ level: "warn", readable: true }),
  messages: [OrderShipped],
  persistence: {
    delay: { type: "memory", pollIntervalMs: 50 },
    deadLetter: { type: "memory" },
  },
});

await source.connect();
await source.setup();

const queue = source.workerQueue(OrderShipped);

// The first argument is the consumer group, not the topic — a static @Topic
// resolves the topic on both sides.
await queue.consume("shipping-labels", async (message, envelope) => {
  console.log("printing label > ", message.orderId, envelope.topic, envelope.attempt);
  throw new Error("label printer offline");
});

await queue.publish(
  queue.create({
    orderId: "ord_7Kq4mN",
    carrier: "PostNord",
    shippedAt: new Date(),
    warehouse: "malmo-1",
  }),
);

await new Promise((resolve) => setTimeout(resolve, 3_000));

for (const entry of await source.getDeadLetters({ topic: "orders.order.shipped" })) {
  console.log("dead letter > ", entry.topic, entry.error, entry.attempt);
}

console.log("purged > ", await source.purgeDeadLetters());

await queue.unconsumeAll();
await source.drain();
await source.disconnect();
