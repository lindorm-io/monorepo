import { SagaEventHandler } from "../../../../src";
import { GreetingCreated } from "./greeting-created.event";
import { UpdateGreeting } from "../commands/update-greeting.command";

const main: SagaEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  saga: "test_saga",
  conditions: { created: false },
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState({ created: ctx.event.initial });
    ctx.logger.info("GreetingCreatedEvent", { event: ctx.event });

    ctx.dispatch(new UpdateGreeting("Hello There"), { delay: 1000 });
  },
};
export default main;
