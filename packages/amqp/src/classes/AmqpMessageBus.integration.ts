import { createMockLogger } from "@lindorm/logger";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { TestMessage } from "../__fixtures__/test-message";
import { IAmqpSubscription } from "../interfaces";
import { AmqpSource } from "./AmqpSource";

describe("AmqpMessageBus", () => {
  let source: AmqpSource;
  let subscription: IAmqpSubscription<TestMessage>;
  let subscriptionOne: IAmqpSubscription<TestMessageOne>;
  let subscriptionTwo: IAmqpSubscription<TestMessageTwo>;

  beforeAll(async () => {
    source = new AmqpSource({
      messages: [TestMessage, TestMessageOne, TestMessageTwo],
      logger: createMockLogger(),
      url: "amqp://localhost:5672",
    });
    await source.setup();
  });

  afterAll(() => {
    source.disconnect();
  });

  test("should subscribe", async () => {
    subscription = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "test.message.queue",
      topic: "test.message",
    };
    subscriptionOne = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "test.message.one.queue",
      topic: "override.test.message.one",
    };
    subscriptionTwo = {
      callback: jest.fn().mockResolvedValue({}),
      queue: "test.message.two.queue",
      topic: "override.test.message.two",
    };

    const bus = source.messageBus(TestMessage);
    const busOne = source.messageBus(TestMessageOne);
    const busTwo = source.messageBus(TestMessageTwo);

    await bus.subscribe(subscription);
    await busOne.subscribe(subscriptionOne);
    await busTwo.subscribe(subscriptionTwo);
  });

  test("should publish", async () => {
    const bus = source.messageBus(TestMessage);
    const busOne = source.messageBus(TestMessageOne);
    const busTwo = source.messageBus(TestMessageTwo);

    const message = bus.create({ name: "test message name" });
    const messageOne = busOne.create({ data: { json: 1 } });
    const messageTwo = busTwo.create({ data: { json: 2 } });

    await bus.publish(message);
    await busOne.publish(messageOne);
    await busTwo.publish(messageTwo);

    expect(subscription.callback).toHaveBeenCalledWith(message);
    expect(subscriptionOne.callback).toHaveBeenCalledWith(messageOne);
    expect(subscriptionTwo.callback).toHaveBeenCalledWith(messageTwo);
  });
});
