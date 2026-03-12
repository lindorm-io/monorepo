import { createMockLogger } from "@lindorm/logger";
import { SubscribeOptions } from "@lindorm/message";
import { wait } from "@lindorm/utils";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageThree } from "../__fixtures__/messages/test-message-three";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { RabbitSource } from "./RabbitSource";

describe("RabbitMessageBus", () => {
  let source: RabbitSource;
  let subscriptionOne: SubscribeOptions<TestMessageOne>;
  let subscriptionTwo: SubscribeOptions<TestMessageTwo>;
  let subscriptionThree: SubscribeOptions<TestMessageThree>;

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
    await busOne.publish(messageOne);

    await wait(() => (subscriptionOne.callback as any).mock.calls.length >= 1);

    const messageTwo = busTwo.create({ name: "test" });
    await busTwo.publish(messageTwo);

    await wait(() => (subscriptionTwo.callback as any).mock.calls.length >= 1);

    const messageThree = busThree.create({ input: "immediate", topic: "whimsy" });
    await busThree.publish(messageThree);

    await wait(() => (subscriptionThree.callback as any).mock.calls.length >= 1);

    const messageThreeDelayed = busThree.create({ input: "delayed", topic: "whimsy" });
    await busThree.publish(messageThreeDelayed, { delay: 1000 });

    await wait(() => (subscriptionThree.callback as any).mock.calls.length >= 2);

    expect(subscriptionOne.callback).toHaveBeenCalledWith(messageOne);
    expect(subscriptionTwo.callback).toHaveBeenCalledWith(messageTwo);
    expect(subscriptionThree.callback).toHaveBeenNthCalledWith(1, messageThree);
    expect(subscriptionThree.callback).toHaveBeenNthCalledWith(2, messageThreeDelayed);
  });
});
