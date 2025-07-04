import { createMockLogger } from "@lindorm/logger";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageThree } from "../__fixtures__/messages/test-message-three";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { IRabbitSubscription } from "../interfaces";
import { RabbitSource } from "./RabbitSource";

describe("RabbitMessageBus", () => {
  let source: RabbitSource;
  let subscriptionOne: IRabbitSubscription<TestMessageOne>;
  let subscriptionTwo: IRabbitSubscription<TestMessageTwo>;
  let subscriptionThree: IRabbitSubscription<TestMessageThree>;

  beforeAll(async () => {
    source = new RabbitSource({
      messages: [TestMessageOne, TestMessageTwo, TestMessageThree],
      logger: createMockLogger(),
      url: "amqp://localhost:5672",
    });
    await source.setup();
  });

  afterAll(() => {
    source.disconnect();
  });

  test("should subscribe", async () => {
    subscriptionOne = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "test.message.one.queue.override",
      topic: "test.message.one.override",
    };
    subscriptionTwo = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "test-message-two.queue",
      topic: "test-message-two",
    };
    subscriptionThree = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "decorated.topic.whimsy.queue",
      topic: "decorated.topic.whimsy",
    };

    const busOne = source.messageBus(TestMessageOne);
    const busTwo = source.messageBus(TestMessageTwo);
    const busThree = source.messageBus(TestMessageThree);

    await busOne.subscribe(subscriptionOne);
    await busTwo.subscribe(subscriptionTwo);
    await busThree.subscribe(subscriptionThree);
  });

  test("should publish", async () => {
    const busOne = source.messageBus(TestMessageOne);
    const busTwo = source.messageBus(TestMessageTwo);
    const busThree = source.messageBus(TestMessageThree);

    const messageOne = busOne.create({ data: { json: 1 }, meta: { test: 2 } });
    const messageTwo = busTwo.create({ name: "test" });
    const messageThree = busThree.create({ topic: "whimsy" });

    await busOne.publish(messageOne);
    await busTwo.publish(messageTwo);
    await busThree.publish(messageThree);

    expect(subscriptionOne.callback).toHaveBeenCalledWith(messageOne);
    expect(subscriptionTwo.callback).toHaveBeenCalledWith(messageTwo);
    expect(subscriptionThree.callback).toHaveBeenCalledWith(messageThree);
  });
});
