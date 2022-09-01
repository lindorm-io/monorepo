import { DomainEvent, TimeoutMessage } from "../message";
import {
  DtoClass,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ISagaEventHandler,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
  State,
} from "../types";

export class SagaEventHandlerImplementation<
  TEvent extends DtoClass = DtoClass,
  TState extends State = State,
  TDispatch extends DtoClass = DtoClass,
> implements ISagaEventHandler<TEvent, TState, TDispatch>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly saga: HandlerIdentifier;
  public readonly version: number;
  public readonly getSagaId: (event: DomainEvent<TEvent> | TimeoutMessage<TEvent>) => string;
  public readonly handler: (
    ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>,
  ) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<TEvent, TState, TDispatch>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.version = options.version || 1;
    this.getSagaId = options.getSagaId ? options.getSagaId : (event): string => event.aggregate.id;
    this.handler = options.handler;
  }
}
