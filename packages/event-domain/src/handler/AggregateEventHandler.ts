import {
  IAggregateEventHandler,
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
} from "../types";

export class AggregateEventHandler<State extends Record<string, any> = Record<string, any>>
  implements IAggregateEventHandler<State>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;
  public readonly handler: (ctx: AggregateEventHandlerContext<State>) => Promise<void>;

  public constructor(options: AggregateEventHandlerOptions<State>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.eventName = options.eventName;
    this.handler = options.handler;
  }
}
