import { IAggregateEventHandler } from "../../../../src";
import { GreetingUpdated } from "./greeting-updated.event";

/**
 * Exporting handlers as [ default ]
 */

export const main: IAggregateEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  handler: async ({ event, mergeState }) => {
    mergeState({
      updated: true,
      v1: { greeting: event.greeting },
    });
  },
};
