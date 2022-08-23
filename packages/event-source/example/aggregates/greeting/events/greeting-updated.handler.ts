import { AggregateEventHandler } from "../../../../src";
import { GreetingUpdated } from "./greeting-updated.event";

/**
 * Exporting versioned handlers as [ default ]
 */

const v1: AggregateEventHandler<GreetingUpdated> = {
  version: 1,
  handler: async (ctx) => {
    ctx.setState("updated", true);
    ctx.mergeState({ v1: { greeting: ctx.event.greeting } });
  },
};

const v2: AggregateEventHandler<GreetingUpdated> = {
  version: 2,
  handler: async (ctx) => {
    ctx.setState("updated", true);
    ctx.mergeState({ v2: { greeting: ctx.event.greeting } });
  },
};

export default [v1, v2];
