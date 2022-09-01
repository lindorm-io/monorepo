import { GreetingCreated } from "./greeting-created.event";
import { ViewEventHandler } from "../../../../src";

const main: ViewEventHandler<GreetingCreated> = {
  name: "postgres_greetings",
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.initial],
    });
  },
};

export default main;
