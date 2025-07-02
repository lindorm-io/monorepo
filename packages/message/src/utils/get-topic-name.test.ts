import { Message } from "../decorators";
import { getTopicName } from "./get-topic-name";

describe("getTopicName", () => {
  test("should get default topic name", () => {
    @Message()
    class TestNameMessageOne {}

    expect(getTopicName(TestNameMessageOne, {})).toEqual("message.test-name-message-one");
  });

  test("should get topic name from namespace decorator", () => {
    @Message({ namespace: "custom" })
    class TestNameMessageTwo {}

    expect(getTopicName(TestNameMessageTwo, { namespace: "namespace" })).toEqual(
      "custom.message.test-name-message-two",
    );
  });

  test("should get topic name from namespace options", () => {
    @Message()
    class TestNameMessageThree {}

    expect(getTopicName(TestNameMessageThree, { namespace: "namespace" })).toEqual(
      "namespace.message.test-name-message-three",
    );
  });

  test("should get topic name from topic decorator", () => {
    @Message({ topic: "decorator.topic.name" })
    class TestNameMessageOne {}

    expect(getTopicName(TestNameMessageOne, { topic: "options.topic.name" })).toEqual(
      "decorator.topic.name",
    );
  });

  test("should get topic name from topic options", () => {
    @Message()
    class TestNameMessageOne {}

    expect(getTopicName(TestNameMessageOne, { topic: "options.topic.name" })).toEqual(
      "options.topic.name",
    );
  });
});
