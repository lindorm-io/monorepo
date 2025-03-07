import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isDateString } from "./is-date-string";

describe("isDateString", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isDateString(value)).toMatchSnapshot();
  });
});
