import { GreetingCreated } from "./greeting-created.event";
import { AggregateEventHandler } from "../../../../src";

/**
 * Exporting versioned handlers as [ main ]
 */

const v1: AggregateEventHandler<GreetingCreated> = {
  version: 1,
  handler: async (ctx) => {
    ctx.setState("created", true);
    ctx.mergeState({ v1: { initial: ctx.event.initial } });
  },
};

const v2: AggregateEventHandler<GreetingCreated> = {
  version: 2,
  handler: async (ctx) => {
    ctx.setState("created", true);
    ctx.mergeState({ v2: { initial: ctx.event.initial } });
  },
};

export const main = [v1, v2];
