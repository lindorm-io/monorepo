import { AggregateEventHandlerFile } from "../../../../src";

/**
 * Exporting versioned handlers as [ main ]
 */

const v1: AggregateEventHandlerFile = {
  version: 1,
  handler: async (ctx) => {
    ctx.setState("created", true);
    ctx.mergeState(ctx.event.data);
  },
};

const v2: AggregateEventHandlerFile = {
  version: 2,
  handler: async (ctx) => {
    ctx.setState("created", true);
    ctx.mergeState(ctx.event.data);
  },
};

export const main: Array<AggregateEventHandlerFile> = [v1, v2];
