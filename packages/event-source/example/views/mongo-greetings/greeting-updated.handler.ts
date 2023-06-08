import { ViewEventHandler } from "../../../src";
import { GreetingUpdated } from "../../aggregates/greeting/events/greeting-updated.event";

const mongo: ViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
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

export default [mongo];
