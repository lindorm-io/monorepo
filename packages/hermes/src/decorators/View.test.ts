import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { View } from "./View";

describe("View Decorator", () => {
  @Aggregate()
  class TestViewAggregate {}

  test("should add metadata", () => {
    @View(TestViewAggregate, "mongo")
    class TestView {}

    expect(globalHermesMetadata.getView(TestView)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @View(TestViewAggregate, "mongo", {
      name: "custom_name",
      namespace: "custom_namespace",
    })
    class TestViewOptions {}

    expect(globalHermesMetadata.getView(TestViewOptions)).toMatchSnapshot();
  });
});
