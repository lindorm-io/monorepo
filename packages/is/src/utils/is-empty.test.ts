import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isEmpty } from "./is-empty";

describe("isEmpty", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isEmpty(value)).toMatchSnapshot();
  });
});
