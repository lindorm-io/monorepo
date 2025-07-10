import { Dict } from "@lindorm/types";
import { ViewEventCtx } from "../types/handlers/view-event-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Event } from "./Event";
import { View } from "./View";
import { ViewEventHandler } from "./ViewEventHandler";

describe("ViewEventHandler Decorator", () => {
  @Aggregate()
  class TestViewAggregate {}

  test("should add metadata", () => {
    @Event()
    class TestViewEventHandlerEvent {}

    @View(TestViewAggregate, "mongo")
    class TestViewEventHandlerView {
      @ViewEventHandler(TestViewEventHandlerEvent)
      public async onTestViewEventHandlerEvent(
        ctx: ViewEventCtx<TestViewEventHandlerEvent, Dict>,
      ) {}
    }

    expect(globalHermesMetadata.getView(TestViewEventHandlerView)).toMatchSnapshot();
  });
});
