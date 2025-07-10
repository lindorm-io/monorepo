import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";

describe("Aggregate Decorator", () => {
  test("should add metadata", () => {
    @Aggregate()
    class TestAggregate {}

    expect(globalHermesMetadata.getAggregate(TestAggregate)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Aggregate({
      encryption: true,
      name: "custom_name",
      namespace: "custom_namespace",
    })
    class TestAggregateOptions {}

    expect(globalHermesMetadata.getAggregate(TestAggregateOptions)).toMatchSnapshot();
  });
});
