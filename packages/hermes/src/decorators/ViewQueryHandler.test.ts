import { Dict } from "@lindorm/types";
import { ViewQueryCtx } from "../types/handlers/view-query-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Query } from "./Query";
import { View } from "./View";
import { ViewQueryHandler } from "./ViewQueryHandler";

describe("ViewQueryHandler Decorator", () => {
  @Aggregate()
  class TestViewAggregate {}

  test("should add metadata", () => {
    @Query()
    class TestViewQueryHandlerQuery {}

    @View(TestViewAggregate, "mongo")
    class TestViewQueryHandlerView {
      @ViewQueryHandler(TestViewQueryHandlerQuery)
      public async onTestViewQueryHandlerQuery(
        ctx: ViewQueryCtx<TestViewQueryHandlerQuery, Dict>,
      ) {}
    }

    expect(globalHermesMetadata.getView(TestViewQueryHandlerView)).toMatchSnapshot();
  });
});
