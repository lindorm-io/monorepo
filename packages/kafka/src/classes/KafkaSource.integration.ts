import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { IKafkaSource } from "../interfaces";
import { KafkaSource } from "./KafkaSource";

describe("KafkaSource", () => {
  let source: IKafkaSource;

  beforeAll(async () => {
    source = new KafkaSource({
      messages: [join(__dirname, "..", "__fixtures__", "messages")],
      logger: createMockLogger(),
      brokers: ["localhost:9092"],
    });
    await source.setup();
  }, 60000);

  afterAll(async () => {
    await source.disconnect();
    if (existsSync(join(process.cwd(), "kafka.db"))) {
      unlinkSync(join(process.cwd(), "kafka.db"));
    }
  });

  test("should return a functioning message bus for directly registered message", async () => {
    const messageBus = source.messageBus(TestMessageTwo);

    expect(messageBus).toBeDefined();

    await expect(
      messageBus.publish(messageBus.create({ name: randomUUID() })),
    ).resolves.not.toThrow();
  });

  test("should return a message bus for directory registered message", () => {
    expect(source.messageBus(TestMessageOne)).toBeDefined();
    expect(source.messageBus(TestMessageTwo)).toBeDefined();
  });
});
