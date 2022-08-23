import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { GreetingUpdated } from "../events/greeting-updated.event";
import { UpdateGreeting } from "./update-greeting.command";

/**
 * Exporting handler as [ default ]
 */

const main: AggregateCommandHandler<UpdateGreeting, GreetingUpdated> = {
  conditions: { created: true },
  schema: Joi.object()
    .keys({
      greeting: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply(new GreetingUpdated(ctx.command.greeting));
  },
};
export default main;
