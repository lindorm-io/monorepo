import { createMockLogger } from "@lindorm/logger";
import { randomUUID } from "crypto";
import { join } from "path";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { IRabbitSource } from "../interfaces";
import { RabbitSource } from "./RabbitSource";

describe("RabbitSource", () => {
  let source: IRabbitSource;

  beforeAll(async () => {
    source = new RabbitSource({
      messages: [join(__dirname, "..", "__fixtures__", "messages")],
      logger: createMockLogger(),
      url: "amqp://localhost:5672",
    });
    await source.setup();
  }, 60000);

  afterAll(() => {
    source.disconnect();
  });

  test("should return a functioning repository for directly registered message", async () => {
    const messageBus = source.messageBus(TestMessageTwo);

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
