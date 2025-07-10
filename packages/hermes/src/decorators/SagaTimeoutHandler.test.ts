import { Dict } from "@lindorm/types";
import { SagaTimeoutCtx } from "../types/handlers/saga-timeout-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Saga } from "./Saga";
import { SagaTimeoutHandler } from "./SagaTimeoutHandler";
import { Timeout } from "./Timeout";

describe("SagaTimeoutHandler Decorator", () => {
  @Aggregate()
  class TestSagaAggregate {}

  test("should add metadata", () => {
    @Timeout()
    class TestSagaTimeoutHandlerTimeout {}

    @Saga(TestSagaAggregate)
    class TestSagaTimeoutHandlerSaga {
      @SagaTimeoutHandler(TestSagaTimeoutHandlerTimeout)
      public async onTestSagaTimeoutHandlerTimeout(
        ctx: SagaTimeoutCtx<TestSagaTimeoutHandlerTimeout, Dict>,
      ) {}
    }

    expect(globalHermesMetadata.getSaga(TestSagaTimeoutHandlerSaga)).toMatchSnapshot();
  });
});
