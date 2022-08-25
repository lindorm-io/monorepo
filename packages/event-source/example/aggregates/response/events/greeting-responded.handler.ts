import { AggregateEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: AggregateEventHandler<GreetingResponded> = {
  handler: async (ctx) => {
    ctx.mergeState({
      responded: true,
      response: ctx.event.response,
    });
  },
};
export default main;
