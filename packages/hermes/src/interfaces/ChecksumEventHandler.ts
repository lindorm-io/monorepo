import { HandlerIdentifier } from "../types";

export interface IHermesChecksumEventHandler {
  aggregate: HandlerIdentifier;
  eventName: string;
}
