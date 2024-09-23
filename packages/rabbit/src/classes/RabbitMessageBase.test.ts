import MockDate from "mockdate";
import { TestMessage } from "../__fixtures__/test-message";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

jest.mock("crypto", () => ({
  randomUUID: () => "032eadb7-3889-48fe-b538-5f3baa879182",
}));

describe("RabbitMessageBase", () => {
  test("should construct", () => {
    const message = new TestMessage({ name: "test message name" });
    expect(message).toEqual({
      id: "032eadb7-3889-48fe-b538-5f3baa879182",
      delay: 0,
      mandatory: false,
      name: "test message name",
      timestamp: MockedDate,
      type: "TestMessage",
    });
    expect(message.topic).toEqual("test.message");
  });
});
