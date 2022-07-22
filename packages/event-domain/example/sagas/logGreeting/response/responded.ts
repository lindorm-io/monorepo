import { SagaEventHandlerFile } from "../../../../src";

const main: SagaEventHandlerFile = {
  getSagaId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.mergeState(ctx.event.data);
    ctx.logger.info("Saga found responded message", { name: ctx.event.name, data: ctx.event.data });
  },
};
export default main;
