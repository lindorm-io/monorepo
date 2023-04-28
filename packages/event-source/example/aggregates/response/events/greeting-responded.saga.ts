import { SagaEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: SagaEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  saga: "test_saga",
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
