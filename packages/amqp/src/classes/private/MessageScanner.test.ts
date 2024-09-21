import { join } from "path";
import { TestMessageOne } from "../../__fixtures__/messages/test-message-one";
import { TestMessageTwo } from "../../__fixtures__/messages/test-message-two";
import { TestMessage } from "../../__fixtures__/test-message";
import { MessageScanner } from "./MessageScanner";

describe("MessageScanner", () => {
  test("should return with array of message constructors", () => {
    expect(MessageScanner.scan([TestMessage, TestMessageOne, TestMessageTwo])).toEqual([
      { Message: TestMessage },
      { Message: TestMessageOne },
      { Message: TestMessageTwo },
    ]);
  });

  test("should return with array of message options objects", () => {
    expect(
      MessageScanner.scan([
        { Message: TestMessage, validate: jest.fn() },
        { Message: TestMessageOne, validate: jest.fn() },
        { Message: TestMessageTwo },
      ]),
    ).toEqual([
      { Message: TestMessage, validate: expect.any(Function) },
      { Message: TestMessageOne, validate: expect.any(Function) },
      { Message: TestMessageTwo },
    ]);
  });

  test("should return with array of message paths", () => {
    expect(
      MessageScanner.scan([join(__dirname, "..", "..", "__fixtures__", "messages")]),
    ).toEqual([
      { Message: TestMessageOne, validate: expect.any(Function) },
      { Message: TestMessageTwo },
    ]);
  });
});
