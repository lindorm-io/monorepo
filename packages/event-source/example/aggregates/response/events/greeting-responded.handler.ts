import { AggregateEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: AggregateEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  handler: async ({ event, mergeState }) => {
    mergeState({
      responded: true,
      response: event.response,
    });
  },
};
export default main;
