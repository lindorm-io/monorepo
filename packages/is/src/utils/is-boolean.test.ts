import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isBoolean } from "./is-boolean";

describe("isBoolean", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isBoolean(value)).toMatchSnapshot();
  });
});
