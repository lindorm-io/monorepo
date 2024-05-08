import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isClass } from "./is-class";

describe("isClass", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isClass(value)).toMatchSnapshot();
  });
});
