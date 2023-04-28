import Joi from "joi";
import { AggregateCommandHandler } from "../../../../src";
import { GreetingCreated } from "../events/greeting-created.event";
import { CreateGreeting } from "./create-greeting.command";

/**
 * Exporting handler as [ main ]
 */

export const main: AggregateCommandHandler<CreateGreeting, GreetingCreated> = {
  command: CreateGreeting,
  conditions: { created: false },
  schema: Joi.object()
    .keys({
      initial: Joi.string().required(),
    })
    .required(),
  handler: async ({ command, apply }) => {
    await apply(new GreetingCreated(command.initial));
  },
};
