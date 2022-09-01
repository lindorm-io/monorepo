import { GreetingCreated } from "./greeting-created.event";
import { AggregateEventHandler } from "../../../../src";

/**
 * Exporting versioned handlers as [ main ]
 */

const v1: AggregateEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  version: 1,
  handler: async (ctx) => {
    ctx.mergeState({
      created: true,
      v1: { initial: ctx.event.initial },
    });
  },
};

const v2: AggregateEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  version: 2,
  handler: async (ctx) => {
    ctx.mergeState({
      created: true,
      v2: { initial: ctx.event.initial },
    });
  },
};

export const main = [v1, v2];
