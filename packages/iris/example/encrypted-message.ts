// @Encrypted seals the payload through a vault key: @lindorm/amphora and
// @lindorm/kryptos are optional peers, required only for this path.
import { Amphora } from "@lindorm/amphora";
import { IrisSource } from "../src/index.js";
import { KryptosKit } from "@lindorm/kryptos";
import { Logger } from "@lindorm/logger";
import { CustomerRecord } from "./messages/CustomerRecord.js";

const logger = new Logger({ level: "warn", readable: true });

const amphora = new Amphora({
  internal: { issuer: "https://orders.example.com" },
  logger,
});

amphora.add(KryptosKit.generate.enc.oct({ algorithm: "A256KW", purpose: "message" }));

const source = new IrisSource({
  driver: "memory",
  logger,
  amphora,
  messages: [CustomerRecord],
  encryption: { condition: { purpose: "message" } },
});

await source.connect();
await source.setup();

const bus = source.messageBus(CustomerRecord);

await bus.subscribe({
  topic: "customers.CustomerRecord",
  callback: async (message) => {
    console.log("decrypted > ", message.customerId, message.address.city);
  },
});

await bus.publish(
  bus.create({
    customerId: "cus_4Rd",
    nationalId: "197001011234",
    address: { street: "Storgatan 1", city: "Malmö" },
  }),
);

await new Promise((resolve) => setTimeout(resolve, 500));

console.log("encryption capability > ", source.capabilities.encryption);

await bus.unsubscribeAll();
await source.drain();
await source.disconnect();
