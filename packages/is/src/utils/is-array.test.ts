import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isArray } from "./is-array";

describe("isArray", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isArray(value)).toMatchSnapshot();
  });
});
