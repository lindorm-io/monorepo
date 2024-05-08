import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isError } from "./is-error";

describe("isError", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isError(value)).toMatchSnapshot();
  });
});
