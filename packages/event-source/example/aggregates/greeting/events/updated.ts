import { AggregateEventHandlerFile } from "../../../../src";

const main: AggregateEventHandlerFile = {
  handler: async (ctx) => {
    ctx.setState("updated", true);
    ctx.mergeState(ctx.event.data);
  },
};
export default main;
