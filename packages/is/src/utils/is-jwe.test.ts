import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isJwe } from "./is-jwe";

describe("isJwe", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isJwe(value)).toMatchSnapshot();
  });
});
