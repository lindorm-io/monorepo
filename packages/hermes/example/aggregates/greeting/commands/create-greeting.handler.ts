import { z } from "zod";
import { IAggregateCommandHandler } from "../../../../src";
import { GreetingCreated } from "../events/greeting-created.event";
import { CreateGreeting } from "./create-greeting.command";

/**
 * Exporting handler as [ main ]
 */

export const main: IAggregateCommandHandler<CreateGreeting, GreetingCreated> = {
  command: CreateGreeting,
  conditions: { created: false },
  schema: z.object({
    initial: z.string(),
  }),
  handler: async ({ command, apply }) => {
    await apply(new GreetingCreated(command.initial));
  },
};
