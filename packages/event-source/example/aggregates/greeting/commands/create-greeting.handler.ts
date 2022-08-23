import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { CreateGreeting } from "./create-greeting.command";
import { GreetingCreated } from "../events/greeting-created.event";

/**
 * Exporting handler as [ main ]
 */

export const main: AggregateCommandHandler<CreateGreeting, GreetingCreated> = {
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      initial: Joi.string().required(),
    })
    .required(),
  handler: async (ctx) => {
    await ctx.apply(new GreetingCreated(ctx.command.initial));
  },
};
