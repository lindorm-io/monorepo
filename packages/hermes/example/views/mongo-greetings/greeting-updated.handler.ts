import { IViewEventHandler, ViewStoreType } from "../../../src";
import { GreetingUpdated } from "../../aggregates/greeting/events/greeting-updated.event";

const mongo: IViewEventHandler<GreetingUpdated> = {
  event: GreetingUpdated,
  adapter: { type: ViewStoreType.Mongo },
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
