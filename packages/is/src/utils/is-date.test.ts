import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isDate } from "./is-date";

describe("isDate", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isDate(value)).toMatchSnapshot();
  });
});
