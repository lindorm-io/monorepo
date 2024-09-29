import { ISagaEventHandler } from "../../../src";
import { GreetingUpdated } from "../../aggregates/greeting/events/greeting-updated.event";
import { RespondGreeting } from "../../aggregates/response/commands/respond-greeting.command";

const main: ISagaEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
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
