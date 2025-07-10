import { DomainError } from "../errors";
import { AggregateErrorCtx } from "../types/handlers/aggregate-error-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { AggregateErrorHandler } from "./AggregateErrorHandler";

describe("AggregateErrorHandler Decorator", () => {
  test("should add metadata", () => {
    @Aggregate()
    class TestAggregateErrorHandlerAggregate {
      @AggregateErrorHandler(DomainError)
      public async onTestAggregateDomainError(ctx: AggregateErrorCtx<DomainError>) {}
    }

    expect(
      globalHermesMetadata.getAggregate(TestAggregateErrorHandlerAggregate),
    ).toMatchSnapshot();
  });
});
