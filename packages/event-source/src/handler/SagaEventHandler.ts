import {
  ClassConstructor,
  GetSagaIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ISagaEventHandler,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
  State,
} from "../types";

export class SagaEventHandlerImplementation<
  TEvent extends ClassConstructor = ClassConstructor,
  TState extends State = State,
  TDispatch extends ClassConstructor = ClassConstructor,
> implements ISagaEventHandler<TEvent, TState, TDispatch>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly saga: HandlerIdentifier;
  public readonly version: number;
  public readonly getSagaId: GetSagaIdFunction<TEvent>;
  public readonly handler: (
    ctx: SagaEventHandlerContext<TEvent, TState, TDispatch>,
  ) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<TEvent, TState, TDispatch>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.version = options.version || 1;
    this.getSagaId = options.getSagaId;
    this.handler = options.handler;
  }
}
