import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isNumber } from "./is-number";

describe("isNumber", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isNumber(value)).toMatchSnapshot();
  });
});
