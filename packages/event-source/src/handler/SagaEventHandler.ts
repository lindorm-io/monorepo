import {
  Data,
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

export class SagaEventHandler<S extends State = State, D extends Data = Data>
  implements ISagaEventHandler<S, D>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly options: SagaStoreHandlerOptions;
  public readonly saga: HandlerIdentifier;
  public readonly version: number;
  public readonly getSagaId: GetSagaIdFunction;
  public readonly handler: (ctx: SagaEventHandlerContext<S, D>) => Promise<void>;

  public constructor(options: SagaEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.options = options.options || {};
    this.saga = { name: options.saga.name, context: options.saga.context };
    this.version = options.version || 1;
    this.getSagaId = options.getSagaId;
    this.handler = options.handler;
  }
}
