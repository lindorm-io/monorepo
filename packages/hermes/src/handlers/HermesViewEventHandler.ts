import { snakeArray, snakeCase } from "@lindorm/case";
import { isArray } from "@lindorm/is";
import { ClassLike, Dict } from "@lindorm/types";
import { IHermesMessage, IHermesViewEventHandler } from "../interfaces";
import {
  HandlerConditions,
  HandlerIdentifier,
  HandlerIdentifierMultipleContexts,
  ViewEventHandlerAdapter,
  ViewEventHandlerContext,
  ViewEventHandlerOptions,
} from "../types";

export class HermesViewEventHandler<
  E extends ClassLike = ClassLike,
  S extends Dict = Dict,
> implements IHermesViewEventHandler<E, S>
{
  public readonly adapter: ViewEventHandlerAdapter;
  public readonly aggregate: HandlerIdentifierMultipleContexts;
  public readonly conditions: HandlerConditions;
  public readonly eventName: string;
  public readonly version: number;
  public readonly view: HandlerIdentifier;
  public readonly getViewId: (event: IHermesMessage<E>) => string;
  public readonly handler: (ctx: ViewEventHandlerContext<E, S>) => Promise<void>;

  public constructor(options: ViewEventHandlerOptions<E, S>) {
    this.adapter = options.adapter;
    this.aggregate = {
      name: snakeCase(options.aggregate.name),
      context: isArray(options.aggregate.context)
        ? snakeArray(options.aggregate.context)
        : snakeCase(options.aggregate.context),
    };
    this.conditions = options.conditions || {};
    this.eventName = snakeCase(options.eventName);
    this.version = options.version || 1;
    this.view = {
      name: snakeCase(options.view.name),
      context: snakeCase(options.view.context),
    };
    this.getViewId = options.getViewId
      ? options.getViewId
      : (event): string => event.aggregate.id;
    this.handler = options.handler;
  }
}
