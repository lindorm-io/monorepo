import { z } from "zod";
import { IAggregateCommandHandler } from "../../../../src";
import { GreetingUpdated } from "../events/greeting-updated.event";
import { UpdateGreeting } from "./update-greeting.command";

/**
 * Exporting handler as [ default ]
 */

const main: IAggregateCommandHandler<UpdateGreeting, GreetingUpdated> = {
  command: UpdateGreeting,
  conditions: { created: true },
  schema: z.object({
    greeting: z.string(),
  }),
  handler: async ({ command, apply }) => {
    await apply(new GreetingUpdated(command.greeting));
  },
};
export default main;
