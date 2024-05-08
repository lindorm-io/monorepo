import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isFinite } from "./is-finite";

describe("isFinite", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isFinite(value)).toMatchSnapshot();
  });
});
