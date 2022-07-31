import {
  IAggregateEventHandler,
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  HandlerIdentifier,
  State,
} from "../types";

export class AggregateEventHandler<S extends State = State> implements IAggregateEventHandler<S> {
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;
  public readonly handler: (ctx: AggregateEventHandlerContext<S>) => Promise<void>;

  public constructor(options: AggregateEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.eventName = options.eventName;
    this.handler = options.handler;
  }
}
