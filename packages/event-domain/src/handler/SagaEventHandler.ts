import {
  GetSagaIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ISagaEventHandler,
  SagaEventHandlerContext,
  SagaEventHandlerOptions,
  SagaStoreHandlerOptions,
  State,
} from "../types";

export class SagaEventHandler<S extends State = State> implements ISagaEventHandler<S> {
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly saga: HandlerIdentifier;
  public readonly options: SagaStoreHandlerOptions;
  public readonly getSagaId: GetSagaIdFunction;
  public readonly handler: (ctx: SagaEventHandlerContext<S>) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.options = options.options || {};
    this.getSagaId = options.getSagaId;
    this.handler = options.handler;
  }
}
