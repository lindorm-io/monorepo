import { AggregateEventHandlerFile } from "../../../../src";

const main: AggregateEventHandlerFile = {
  handler: async (ctx) => {
    ctx.setState("created", true);
    ctx.mergeState(ctx.event.data);
  },
};

/**
 * Exporting handler as [ default ]
 */
export default main;
