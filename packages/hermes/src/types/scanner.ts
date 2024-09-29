import { HandlerIdentifier } from "./identifiers";

export type GetAggregateEventData = {
  eventName: string;
  aggregate: HandlerIdentifier;
};
