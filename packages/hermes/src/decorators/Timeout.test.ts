import { globalHermesMetadata } from "../utils/private";
import { Timeout } from "./Timeout";

describe("Timeout Decorator", () => {
  test("should add metadata", () => {
    @Timeout()
    class TestTimeout {}

    expect(globalHermesMetadata.getTimeout(TestTimeout)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Timeout({
      name: "custom_name",
      version: 2,
    })
    class TestSagaTimeoutOptions {}

    expect(globalHermesMetadata.getTimeout(TestSagaTimeoutOptions)).toMatchSnapshot();
  });
});
