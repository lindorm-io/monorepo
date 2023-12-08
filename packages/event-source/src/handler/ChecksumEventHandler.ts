import { ChecksumEventHandlerOptions, HandlerIdentifier, IChecksumEventHandler } from "../types";

export class ChecksumEventHandlerImplementation implements IChecksumEventHandler {
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;

  public constructor(options: ChecksumEventHandlerOptions) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.eventName = options.eventName;
  }
}
