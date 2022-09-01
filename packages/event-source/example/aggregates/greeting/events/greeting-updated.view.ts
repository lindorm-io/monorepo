import { GreetingUpdated } from "./greeting-updated.event";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  view: "postgres_greetings",
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.greeting],
    });
  },
};

export default main;
