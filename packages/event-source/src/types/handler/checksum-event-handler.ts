import { HandlerIdentifier } from "./handler";

export interface ChecksumEventHandlerOptions {
  aggregate: HandlerIdentifier;
  eventName: string;
}

export interface IChecksumEventHandler {
  aggregate: HandlerIdentifier;
  eventName: string;
}
