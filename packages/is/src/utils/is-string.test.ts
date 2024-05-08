import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isString } from "./is-string";

describe("isString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isString(value)).toMatchSnapshot();
  });
});
