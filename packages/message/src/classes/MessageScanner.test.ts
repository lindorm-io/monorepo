import { Dict } from "@lindorm/types";
import { join } from "path";
import { TestMessageOne } from "../__fixtures__/messages/test-message-one";
import { TestMessageThree } from "../__fixtures__/messages/test-message-three";
import { TestMessageTwo } from "../__fixtures__/messages/test-message-two";
import { MessageScanner } from "./MessageScanner";

describe("MessageScanner", () => {
  test("should return with array of message constructors", () => {
    expect(
      MessageScanner.scan<Dict>([TestMessageOne, TestMessageTwo, TestMessageThree]),
    ).toEqual([TestMessageOne, TestMessageTwo, TestMessageThree]);
  });

  test("should return with array of message paths", () => {
    expect(
      MessageScanner.scan([join(__dirname, "..", "__fixtures__", "messages")]),
    ).toEqual([TestMessageOne, TestMessageThree, TestMessageTwo]);
  });
});
