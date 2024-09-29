import { IAggregateEventHandler } from "../../../../src";
import { GreetingResponded } from "./greeting-responded.event";

const main: IAggregateEventHandler<GreetingResponded> = {
  event: GreetingResponded,
  handler: async ({ event, mergeState }) => {
    mergeState({
      responded: true,
      response: event.response,
    });
  },
};
export default main;
