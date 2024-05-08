import { TEST_ARRAY_WITH_OBJECTS, TEST_OBJECT } from "../../__fixtures__/objects";
import { INVALID_INPUT, TEST_STRINGS } from "../../__fixtures__/strings";
import { sentenceArray, sentenceCase, sentenceKeys } from "./sentence";

describe("sentenceCase", () => {
  test.each(TEST_STRINGS)("should convert %s", (input) => {
    expect(sentenceCase(input)).toMatchSnapshot();
  });

  test("should convert object keys", () => {
    expect(sentenceKeys(TEST_OBJECT)).toMatchSnapshot();
  });

  test("should convert array with objects", () => {
    expect(sentenceKeys(TEST_ARRAY_WITH_OBJECTS)).toMatchSnapshot();
  });

  test("should convert array with strings", () => {
    expect(sentenceArray(TEST_STRINGS)).toMatchSnapshot();
  });

  test.each(INVALID_INPUT)("should throw for invalid input $type", ({ value }) => {
    expect(() => sentenceCase(value)).toThrow(Error);
  });
});
