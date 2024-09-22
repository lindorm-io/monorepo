import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { TestMessage } from "../__fixtures__/test-message";
import { AmqpSource } from "./AmqpSource";

describe("AmqpSource", () => {
  let source: AmqpSource;

  beforeAll(async () => {
    source = new AmqpSource({
      messages: [TestMessage, join(__dirname, "..", "__fixtures__", "messages")],
      logger: createMockLogger(),
      url: "amqp://localhost:5672",
    });
    await source.setup();
  });

  afterAll(() => {
    source.disconnect();
  });

  test("should return a functioning repository for directly registered message", async () => {
    const messageBus = source.messageBus(TestMessage);

    expect(messageBus).toBeDefined();

    await expect(
      messageBus.publish(messageBus.create({ name: randomUUID() })),
    ).resolves.not.toThrow();
  });

  test("should return a repository for directory registered message", () => {
    expect(source.messageBus(TestMessageOne)).toBeDefined();
    expect(source.messageBus(TestMessageTwo)).toBeDefined();
  });
});
