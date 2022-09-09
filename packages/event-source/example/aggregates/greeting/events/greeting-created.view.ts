import { GreetingCreated } from "./greeting-created.event";
import { ViewEventHandler } from "../../../../src";

const mongo: ViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.initial],
    });
  },
};

const postgres: ViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async (ctx) => {
    ctx.setState({
      ...ctx.state,
      messages: [...(ctx.state.messages || []), ctx.event.initial],
    });
  },
};

export default [mongo, postgres];
