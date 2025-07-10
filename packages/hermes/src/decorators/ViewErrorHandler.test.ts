import { DomainError } from "../errors";
import { ViewErrorCtx } from "../types/handlers/view-error-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { View } from "./View";
import { ViewErrorHandler } from "./ViewErrorHandler";

describe("ViewErrorHandler Decorator", () => {
  @Aggregate()
  class TestViewAggregate {}

  test("should add metadata", () => {
    @View(TestViewAggregate, "mongo")
    class TestViewErrorHandlerView {
      @ViewErrorHandler(DomainError)
      public async onTestViewDomainError(ctx: ViewErrorCtx<DomainError>) {}
    }

    expect(globalHermesMetadata.getView(TestViewErrorHandlerView)).toMatchSnapshot();
  });
});
