import { SagaEventHandler } from "../../../src";
import { GreetingResponded } from "../../aggregates/response/events/greeting-responded.event";

const main: SagaEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  conditions: { created: true },
  getSagaId: (event) => event.aggregate.id,
  handler: async ({ event, logger, mergeState }) => {
    mergeState({ responded: event.response });
    logger.info("GreetingRespondedEvent", { event });
    //
    // Enable these to test the error handler
    //
    // destroy();
    // setState({});
  },
};
export default main;
