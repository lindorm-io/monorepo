import { ViewIdCtx } from "../types";
import { globalHermesMetadata } from "../utils/private";
import { Aggregate } from "./Aggregate";
import { Event } from "./Event";
import { View } from "./View";
import { ViewIdHandler } from "./ViewIdHandler";

describe("ViewIdHandler Decorator", () => {
  @Aggregate()
  class TestViewAggregate {}

  test("should add metadata", () => {
    @Event()
    class TestViewIdentityHandlerEvent {
      public constructor(public readonly one: string) {}
    }

    @View(TestViewAggregate, "mongo")
    class TestViewIdentityHandlerView {
      @ViewIdHandler(TestViewIdentityHandlerEvent)
      public getIdTestViewIdentityHandlerEvent(
        ctx: ViewIdCtx<TestViewIdentityHandlerEvent>,
      ) {
        return ctx.event.one;
      }
    }

    expect(globalHermesMetadata.getView(TestViewIdentityHandlerView)).toMatchSnapshot();
  });
});
