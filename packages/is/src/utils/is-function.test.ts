import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isFunction } from "./is-function";

describe("isFunction", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFunction(value)).toMatchSnapshot();
  });
});
