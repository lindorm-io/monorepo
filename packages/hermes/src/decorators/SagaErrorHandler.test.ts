import { DomainError } from "../errors";
import { SagaErrorCtx } from "../types/handlers/saga-error-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Saga } from "./Saga";
import { SagaErrorHandler } from "./SagaErrorHandler";

describe("SagaErrorHandler Decorator", () => {
  @Aggregate()
  class TestSagaAggregate {}

  test("should add metadata", () => {
    @Saga(TestSagaAggregate)
    class TestSagaErrorHandlerSaga {
      @SagaErrorHandler(DomainError)
      public async onTestSagaDomainError(ctx: SagaErrorCtx<DomainError>) {}
    }

    expect(globalHermesMetadata.getSaga(TestSagaErrorHandlerSaga)).toMatchSnapshot();
  });
});
