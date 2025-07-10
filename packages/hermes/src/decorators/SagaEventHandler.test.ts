import { Dict } from "@lindorm/types";
import { SagaEventCtx } from "../types/handlers/saga-event-handler";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Event } from "./Event";
import { Saga } from "./Saga";
import { SagaEventHandler } from "./SagaEventHandler";

describe("SagaEventHandler Decorator", () => {
  @Aggregate()
  class TestSagaAggregate {}

  test("should add metadata", () => {
    @Event()
    class TestSagaEventHandlerEvent {}

    @Saga(TestSagaAggregate)
    class TestSagaEventHandlerSaga {
      @SagaEventHandler(TestSagaEventHandlerEvent)
      public async onTestSagaEventHandlerEvent(
        ctx: SagaEventCtx<TestSagaEventHandlerEvent, Dict>,
      ) {}
    }

    expect(globalHermesMetadata.getSaga(TestSagaEventHandlerSaga)).toMatchSnapshot();
  });
});
