import { SagaEventHandler } from "../../../../src";
import { RespondGreeting } from "../../response/commands/respond-greeting.command";
import { GreetingUpdated } from "./greeting-updated.event";

const main: SagaEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  saga: "test_saga",
  conditions: { created: true },
  getSagaId: (event) => event.aggregate.id,
  handler: async ({ event, logger, dispatch, mergeState }) => {
    mergeState({ updated: event.greeting });
    logger.info("GreetingUpdatedEvent", { event });

    dispatch(new RespondGreeting("General Kenobi"), {
      aggregate: { name: "response" },
      delay: 1000,
    });
  },
};
export default main;
