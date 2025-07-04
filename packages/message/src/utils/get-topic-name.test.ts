import { Field, Message, Topic } from "../decorators";
import { getTopicName } from "./get-topic-name";

describe("getTopicName", () => {
  test("should get default topic name", () => {
    @Message()
    class TestMessageOne {}

    expect(getTopicName(TestMessageOne, new TestMessageOne(), {})).toEqual(
      "test-message-one",
    );
  });

  test("should modify topic name from namespace decorator", () => {
    @Message({ namespace: "custom" })
    class TestMessageTwo {}

    expect(
      getTopicName(TestMessageTwo, new TestMessageTwo(), { namespace: "namespace" }),
    ).toEqual("custom.test-message-two");
  });

  test("should modify topic name from namespace options", () => {
    @Message()
    class TestMessageThree {}

    expect(
      getTopicName(TestMessageThree, new TestMessageThree(), { namespace: "namespace" }),
    ).toEqual("namespace.test-message-three");
  });

  test("should get topic name from message decorator", () => {
    @Message({ topic: "decorator.topic.name" })
    class TestMessageFour {}

    expect(
      getTopicName(TestMessageFour, new TestMessageFour(), {
        topic: "options.topic.name",
      }),
    ).toEqual("decorator.topic.name");
  });

  test("should get topic name from topic options", () => {
    @Message()
    class TestMessageFive {}

    expect(
      getTopicName(TestMessageFive, new TestMessageFive(), {
        topic: "options.topic.name",
      }),
    ).toEqual("options.topic.name");
  });

  test("should get topic name from callback decorator", () => {
    @Message()
    @Topic((message) => `callback.topic.name.${message.field}`)
    class TestMessageSix {
      @Field()
      public field!: string;
    }
    const message = new TestMessageSix();
    message.field = "test";

    expect(getTopicName(TestMessageSix, message, {})).toEqual("callback.topic.name.test");
  });
});
