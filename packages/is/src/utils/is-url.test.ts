import { TEST_FIXTURES } from "../__fixtures__/test-fixtures";
import { isUrl } from "./is-url";

describe("isUrl", () => {
  test.each(Object.entries(TEST_FIXTURES))("should resolve %s", (key, value) => {
    expect(isUrl(value)).toMatchSnapshot();
  });
});
