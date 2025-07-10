import { SagaIdCtx } from "../types";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Event } from "./Event";
import { Saga } from "./Saga";
import { SagaIdHandler } from "./SagaIdHandler";

describe("SagaIdHandler Decorator", () => {
  @Aggregate()
  class TestSagaAggregate {}

  test("should add metadata", () => {
    @Event()
    class TestSagaIdentityHandlerEvent {
      public constructor(public readonly one: string) {}
    }

    @Saga(TestSagaAggregate)
    class TestSagaIdentityHandlerSaga {
      @SagaIdHandler(TestSagaIdentityHandlerEvent)
      public getIdTestSagaIdentityHandlerEvent(
        ctx: SagaIdCtx<TestSagaIdentityHandlerEvent>,
      ) {
        return ctx.event.one;
      }
    }

    expect(globalHermesMetadata.getSaga(TestSagaIdentityHandlerSaga)).toMatchSnapshot();
  });
});
