import Joi from "joi";
import { AggregateCommandHandlerFile } from "../../../../src";

const main: AggregateCommandHandlerFile = {
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      initial: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply("created", ctx.command.data);
  },
};
export default main;
