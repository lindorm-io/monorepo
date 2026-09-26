import { IrisSource } from "../src/index.js";
import { Logger } from "@lindorm/logger";
import { OrderPlaced } from "./messages/OrderPlaced.js";

const logger = new Logger({ level: "warn", readable: true });

const source = new IrisSource({
  driver: "memory",
  logger,
  messages: [OrderPlaced],
});

await source.connect();
await source.setup();

// A session shares the driver connection and carries its own logger and meta —
// one per request, no reconnect.
const scoped = source.session({
  logger: logger.child(["request"]),
  meta: { correlationId: "req_9Tf2", actor: "user:42", timestamp: new Date() },
});

const publisher = scoped.publisher(OrderPlaced);

await publisher.publish(
  publisher.create({
    orderId: "ord_9Tf2",
    customerEmail: "buyer@example.com",
    total: 12.5,
    lineCount: 1,
    skus: ["WIDGET-42"],
    attributes: {},
    couponCode: null,
  }),
);

console.log("same driver > ", scoped.driver === source.driver);
console.log("knows type  > ", scoped.hasMessage(OrderPlaced));

await source.drain();
await source.disconnect();
