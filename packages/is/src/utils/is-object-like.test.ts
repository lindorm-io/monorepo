import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isObjectLike } from "./is-object-like";

describe("isObjectLike", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isObjectLike(value)).toMatchSnapshot();
  });
});
