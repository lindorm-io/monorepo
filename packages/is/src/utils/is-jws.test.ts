import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isJws } from "./is-jws";

describe("isJws", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJws(value)).toMatchSnapshot();
  });
});
