import { snakeCase } from "@lindorm/case";
import { IHermesChecksumEventHandler } from "../interfaces";
import { ChecksumEventHandlerOptions, HandlerIdentifier } from "../types";

export class HermesChecksumEventHandler implements IHermesChecksumEventHandler {
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;

  public constructor(options: ChecksumEventHandlerOptions) {
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: snakeCase(options.aggregate.context),
    };
    this.eventName = snakeCase(options.eventName);
  }
}
