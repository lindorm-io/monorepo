import { SagaEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: SagaEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  saga: "test_saga",
  conditions: { created: true },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState({ responded: ctx.event.response });
    ctx.logger.info("GreetingRespondedEvent", { event: ctx.event });
  },
};
export default main;
