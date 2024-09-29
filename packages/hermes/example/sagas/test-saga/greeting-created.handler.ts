import { ISagaEventHandler } from "../../../src";
import { UpdateGreeting } from "../../aggregates/greeting/commands/update-greeting.command";
import { GreetingCreated } from "../../aggregates/greeting/events/greeting-created.event";

const main: ISagaEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  conditions: { created: false },
  getSagaId: (event) => event.aggregate.id,
  handler: async ({ event, logger, dispatch, mergeState }) => {
    mergeState({ created: event.initial });
    logger.info("GreetingCreatedEvent", { event });

    dispatch(new UpdateGreeting("Hello There"), { delay: 1000 });
  },
};
export default main;
