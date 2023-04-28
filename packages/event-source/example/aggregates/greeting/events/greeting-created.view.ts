import { ViewEventHandler } from "../../../../src";
import { GreetingCreated } from "./greeting-created.event";

const mongo: ViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  view: "mongo_greetings",
  adapter: { type: "mongo" },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.initial],
    });
  },
};

const postgres: ViewEventHandler<GreetingCreated> = {
  event: GreetingCreated,
  view: "postgres_greetings",
  adapter: { type: "postgres" },
  conditions: { created: false },
  getViewId: (event) => event.aggregate.id,
  handler: async ({ event, state, setState }) => {
    setState({
      ...state,
      messages: [...(state.messages || []), event.initial],
    });
  },
};

export default [mongo, postgres];
