import { SagaEventHandlerFile } from "../../../../src";

const main: SagaEventHandlerFile = {
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.logger.info("Saga found updated greeting", { name: ctx.event.name, data: ctx.event.data });
    ctx.dispatch("respond", { respond: "General Kenobi" }, { aggregate: { name: "response" } });
  },
};
export default main;
