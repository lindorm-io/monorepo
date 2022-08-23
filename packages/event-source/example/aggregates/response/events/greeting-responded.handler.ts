import { AggregateEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: AggregateEventHandler<GreetingResponded> = {
  handler: async (ctx) => {
    ctx.setState("responded", true);
    ctx.mergeState({ response: ctx.event.response });
  },
};
export default main;
