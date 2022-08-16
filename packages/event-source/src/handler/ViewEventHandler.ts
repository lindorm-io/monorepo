import {
  Data,
  GetViewIdFunction,
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  IViewEventHandler,
  State,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
  ViewStoreHandlerOptions,
} from "../types";

export class ViewEventHandler<S extends State = State, D extends Data = Data>
  implements IViewEventHandler<S, D>
{
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly persistence: ViewStoreHandlerOptions;
  public readonly version: number;
  public readonly view: HandlerIdentifier;
  public readonly getViewId: GetViewIdFunction;
  public readonly handler: (ctx: ViewEventHandlerContext<S, D>) => Promise<void>;

  public constructor(options: ViewEventHandlerOptions<S>) {
    this.aggregate = { name: options.aggregate.name, context: options.aggregate.context };
    this.conditions = options.conditions || {};
    this.eventName = options.eventName;
    this.persistence = options.persistence;
    this.version = options.version || 1;
    this.view = { name: options.view.name, context: options.view.context };
    this.getViewId = options.getViewId;
    this.handler = options.handler;
  }
}
