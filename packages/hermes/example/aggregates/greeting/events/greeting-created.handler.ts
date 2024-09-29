import { IAggregateEventHandler } from "../../../../src";
import { GreetingCreated } from "./greeting-created.event";

/**
 * Exporting handlers as [ main ]
 */

export const main: IAggregateEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  handler: async ({ event, mergeState }) => {
    mergeState({
      created: true,
      v1: { initial: event.initial },
    });
  },
};
