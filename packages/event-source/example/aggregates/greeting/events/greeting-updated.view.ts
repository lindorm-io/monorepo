import { ViewEventHandler } from "../../../../src";
import { GreetingUpdated } from "./greeting-updated.event";

const mongo: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.greeting],
    });
  },
};

const postgres: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: true },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.greeting],
    });
  },
};

export default [mongo, postgres];
