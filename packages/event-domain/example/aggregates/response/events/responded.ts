import { AggregateEventHandlerFile } from "../../../../src";

const main: AggregateEventHandlerFile = {
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
  },
};
export default main;
