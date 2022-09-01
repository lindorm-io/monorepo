import { SagaEventHandler } from "../../../../src";
import { GreetingUpdated } from "./greeting-updated.event";
import { RespondGreeting } from "../../response/commands/respond-greeting.command";

const main: SagaEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  saga: "test_saga",
  conditions: { created: true },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState({ updated: ctx.event.greeting });
    ctx.logger.info("GreetingUpdatedEvent", { event: ctx.event });

    ctx.dispatch(new RespondGreeting("General Kenobi"), {
      aggregate: { name: "response" },
      delay: 1000,
    });
  },
};
export default main;
