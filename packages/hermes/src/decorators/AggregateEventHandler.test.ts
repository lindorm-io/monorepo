import { Dict } from "@lindorm/types";
import { AggregateEventCtx } from "../types/handlers/aggregate-event-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { AggregateEventHandler } from "./AggregateEventHandler";
import { Event } from "./Event";

describe("AggregateEventHandler Decorator", () => {
  test("should add metadata", () => {
    @Event()
    class TestEvent {}

    @Aggregate()
    class TestAggregateEventHandlerAggregate {
      @AggregateEventHandler(TestEvent)
      public async onTestAggregateDomainEvent(ctx: AggregateEventCtx<TestEvent, Dict>) {}
    }

    expect(
      globalHermesMetadata.getAggregate(TestAggregateEventHandlerAggregate),
    ).toMatchSnapshot();
  });
});
