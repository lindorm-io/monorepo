import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Saga } from "./Saga";

describe("Saga Decorator", () => {
  @Aggregate()
  class TestSagaAggregate {}

  test("should add metadata", () => {
    @Saga(TestSagaAggregate)
    class TestSaga {}

    expect(globalHermesMetadata.getSaga(TestSaga)).toMatchSnapshot();
  });

  test("should add metadata with custom options", () => {
    @Saga(TestSagaAggregate, {
      name: "custom_name",
      namespace: "custom_namespace",
    })
    class TestSagaOptions {}

    expect(globalHermesMetadata.getSaga(TestSagaOptions)).toMatchSnapshot();
  });
});
