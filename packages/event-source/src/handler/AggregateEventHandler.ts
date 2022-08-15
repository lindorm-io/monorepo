import {
  IAggregateEventHandler,
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
  State,
  Data,
} from "../types";

export class AggregateEventHandler<S extends State = State, D extends Data = Data>
  implements IAggregateEventHandler<S, D>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;
  public readonly handler: (ctx: AggregateEventHandlerContext<S, D>) => Promise<void>;

  public constructor(options: AggregateEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.eventName = options.eventName;
    this.handler = options.handler;
  }
}
