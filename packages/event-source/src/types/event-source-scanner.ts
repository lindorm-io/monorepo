import { HandlerIdentifier } from "./handler";

export type GetAggregateEventData = {
  eventName: string;
  aggregate: HandlerIdentifier;
};
