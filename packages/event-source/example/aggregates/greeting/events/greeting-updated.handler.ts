import { AggregateEventHandler } from "../../../../src";
import { GreetingUpdated } from "./greeting-updated.event";

/**
 * Exporting handlers as [ default ]
 */

export const main: AggregateEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  handler: async ({ event, mergeState }) => {
    mergeState({
      updated: true,
      v1: { greeting: event.greeting },
    });
  },
};
