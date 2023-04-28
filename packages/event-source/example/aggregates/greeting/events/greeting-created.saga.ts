import { SagaEventHandler } from "../../../../src";
import { UpdateGreeting } from "../commands/update-greeting.command";
import { GreetingCreated } from "./greeting-created.event";

const main: SagaEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  saga: "test_saga",
  conditions: { created: false },
  getSagaId: (event) => event.aggregate.id,
  handler: async ({ event, logger, dispatch, mergeState }) => {
    mergeState({ created: event.initial });
    logger.info("GreetingCreatedEvent", { event });

    dispatch(new UpdateGreeting("Hello There"), { delay: 1000 });
  },
};
export default main;
