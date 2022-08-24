import {
  AggregateEventHandlerContext,
  AggregateEventHandlerOptions,
  DtoClass,
  HandlerIdentifier,
  IAggregateEventHandler,
  State,
} from "../types";

export class AggregateEventHandlerImplementation<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
> implements IAggregateEventHandler<TEvent, TState>
{
  public readonly aggregate: HandlerIdentifier;
  public readonly eventName: string;
  public readonly version: number;
  public readonly handler: (ctx: AggregateEventHandlerContext<TEvent, TState>) => Promise<void>;

  public constructor(options: AggregateEventHandlerOptions<TEvent, TState>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.eventName = options.eventName;
    this.version = options.version || 1;
    this.handler = options.handler;
  }
}
