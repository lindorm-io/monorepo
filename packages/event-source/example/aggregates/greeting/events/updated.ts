import { AggregateEventHandlerFile } from "../../../../src";

/**
 * Exporting versioned handlers as [ default ]
 */

const v1: AggregateEventHandlerFile = {
  version: 1,
  handler: async (ctx) => {
    ctx.setState("updated", true);
    ctx.mergeState(ctx.event.data);
  },
};

const v2: AggregateEventHandlerFile = {
  version: 2,
  handler: async (ctx) => {
    ctx.setState("updated", true);
    ctx.mergeState(ctx.event.data);
  },
};

export default [v1, v2];
